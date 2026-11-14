package com.orbetv.app;

import android.app.Activity;
import android.app.PictureInPictureParams;
import android.app.UiModeManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Rational;
import android.util.TypedValue;
import android.view.GestureDetector;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.OptIn;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.exoplayer.source.MediaSource;
import androidx.media3.ui.AspectRatioFrameLayout;
import androidx.media3.ui.PlayerView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Reproductor de TV a pantalla completa.
 * - Zapping: ▲/▼ o CH+/CH− en el control remoto; en el celular, deslizar arriba/abajo.
 * - Si la señal principal falla prueba las alternativas; si el canal está caído, pasa al siguiente.
 * - En el celular, al salir con el botón de inicio sigue en una ventanita (imagen en imagen).
 */
@OptIn(markerClass = UnstableApi.class)
public class PlayerActivity extends Activity {

    static final String UA = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36 OrbeTV/1.0";

    /** Lista de canales y posición inicial (la deja MainActivity antes de abrir). */
    static List<JSONObject> pendingList = new ArrayList<>();
    static int pendingIndex = 0;
    /** Avisa a la pantalla principal del canal que se está viendo. */
    interface Listener { void onChannel(JSONObject ch); }
    static Listener listener;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Handler adHandler = new Handler(Looper.getMainLooper());
    private long watchingSince = System.currentTimeMillis();

    /** Viendo sin parar: un anuncio cada 20 min (máx. 2 cada 40 min, nunca en la TV ni en la ventanita). */
    private final Runnable midRoll = new Runnable() {
        @Override public void run() {
            AdsManager ads = AdsManager.get();
            long now = System.currentTimeMillis();
            if (AdsConfig.MID_ROLL_EVERY_MS > 0 && ads != null && !isTv && player != null && player.isPlaying()
                    && !isInPictureInPictureMode()
                    && now - watchingSince >= AdsConfig.MID_ROLL_EVERY_MS
                    && ads.sinceLastAd() >= AdsConfig.MID_ROLL_EVERY_MS && ads.canShow()) {
                player.pause();
                ads.showInterstitialThen(PlayerActivity.this, () -> {
                    watchingSince = System.currentTimeMillis();
                    if (player != null) { player.seekToDefaultPosition(); player.play(); }
                });
            }
            adHandler.postDelayed(this, 60_000);
        }
    };
    private List<JSONObject> list;
    private int index, streamIdx, failures, direction = 1;
    private ExoPlayer player;
    private PlayerView view;
    private TextView info, status;
    private boolean isTv;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        UiModeManager ui = (UiModeManager) getSystemService(UI_MODE_SERVICE);
        isTv = ui != null && ui.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION;
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        list = new ArrayList<>(pendingList);
        index = Math.max(0, Math.min(pendingIndex, list.size() - 1));

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        view = new PlayerView(this);
        view.setResizeMode(AspectRatioFrameLayout.RESIZE_MODE_FIT);
        view.setShowBuffering(PlayerView.SHOW_BUFFERING_ALWAYS);
        view.setControllerShowTimeoutMs(3500);
        root.addView(view, new FrameLayout.LayoutParams(-1, -1));

        info = new TextView(this);
        info.setTextColor(Color.WHITE);
        info.setTextSize(TypedValue.COMPLEX_UNIT_SP, isTv ? 20 : 16);
        info.setTypeface(Typeface.DEFAULT_BOLD);
        info.setShadowLayer(8, 0, 2, Color.BLACK);
        int pad = dp(14);
        info.setPadding(dp(16), pad, dp(16), pad);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(0xCC090E1C);
        bg.setCornerRadius(dp(16));
        info.setBackground(bg);
        FrameLayout.LayoutParams ilp = new FrameLayout.LayoutParams(-2, -2, Gravity.TOP | Gravity.START);
        ilp.setMargins(dp(isTv ? 48 : 16), dp(isTv ? 27 : 16), dp(16), 0);
        root.addView(info, ilp);

        status = new TextView(this);
        status.setTextColor(Color.WHITE);
        status.setTextSize(TypedValue.COMPLEX_UNIT_SP, isTv ? 20 : 16);
        status.setGravity(Gravity.CENTER);
        status.setShadowLayer(8, 0, 2, Color.BLACK);
        root.addView(status, new FrameLayout.LayoutParams(-1, -2, Gravity.CENTER));
        setContentView(root);
        hideSystemBars();

        player = new ExoPlayer.Builder(this).build();
        player.addListener(new Player.Listener() {
            @Override public void onPlayerError(@NonNull PlaybackException e) { onError(e); }
            @Override public void onPlaybackStateChanged(int state) {
                if (state == Player.STATE_READY) {
                    failures = 0; status.setText("");
                    StationStore.markOk(PlayerActivity.this, current().optString("id"));
                }
            }
        });
        view.setPlayer(player);

        // Deslizar arriba/abajo cambia de canal (celular y tableta)
        GestureDetector gd = new GestureDetector(this, new GestureDetector.SimpleOnGestureListener() {
            @Override
            public boolean onFling(MotionEvent e1, @NonNull MotionEvent e2, float vx, float vy) {
                if (Math.abs(vy) > Math.abs(vx) * 1.5 && Math.abs(vy) > 800) { zap(vy < 0 ? 1 : -1); return true; }
                return false;
            }
        });
        view.setOnTouchListener((v, ev) -> { gd.onTouchEvent(ev); return false; });

        if (list.isEmpty()) { finish(); return; }
        playCurrent(true);
        handler.postDelayed(() -> showInfo(isTv ? "▲ ▼  cambiar de canal" : "Desliza ↑ ↓ para cambiar de canal"), 600);
    }

    private int dp(int v) { return (int) (v * getResources().getDisplayMetrics().density); }

    private void hideSystemBars() {
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.systemBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        }
    }

    private JSONObject current() { return list.get(index); }

    private void playCurrent(boolean resetStream) {
        if (resetStream) streamIdx = 0;
        JSONObject ch = current();
        JSONArray streams = ch.optJSONArray("streams");
        String url = ch.optString("url");
        String ua = "", ref = "";
        if (streams != null && streams.length() > streamIdx) {
            JSONArray s = streams.optJSONArray(streamIdx);
            if (s != null) { url = s.optString(0, url); ua = s.optString(1, ""); ref = s.optString(2, ""); }
        }
        status.setText("Sintonizando…");
        player.setMediaSource(buildSource(url, ua, ref, ch.optString("name")));
        player.prepare();
        player.play();
        StationStore.setLast(this, ch);
        Listener l = listener;
        if (l != null) l.onChannel(ch);
        showInfo(null);
    }

    private MediaSource buildSource(String url, String ua, String ref, String title) {
        DefaultHttpDataSource.Factory http = new DefaultHttpDataSource.Factory()
                .setUserAgent(ua.isEmpty() ? UA : ua)
                .setAllowCrossProtocolRedirects(true)
                .setConnectTimeoutMs(15000)
                .setReadTimeoutMs(20000);
        if (!ref.isEmpty()) {
            Map<String, String> h = new HashMap<>();
            h.put("Referer", ref);
            h.put("Origin", ref.replaceAll("/$", ""));
            http.setDefaultRequestProperties(h);
        }
        MediaItem.Builder b = new MediaItem.Builder().setUri(url)
                .setMediaMetadata(new MediaMetadata.Builder().setTitle(title).build());
        String low = url.toLowerCase();
        if (low.contains(".m3u8")) b.setMimeType(MimeTypes.APPLICATION_M3U8);
        else if (low.contains(".mpd")) b.setMimeType(MimeTypes.APPLICATION_MPD);
        return new DefaultMediaSourceFactory(new DefaultDataSource.Factory(this, http)).createMediaSource(b.build());
    }

    private void onError(PlaybackException e) {
        // Directo atrasado: volver al punto en vivo
        if (e.errorCode == PlaybackException.ERROR_CODE_BEHIND_LIVE_WINDOW) {
            player.seekToDefaultPosition();
            player.prepare();
            return;
        }
        JSONArray streams = current().optJSONArray("streams");
        if (streams != null && streamIdx + 1 < streams.length()) {
            streamIdx++;
            status.setText("Probando otra señal…");
            playCurrent(false);
            return;
        }
        failures++;
        // Ninguna señal del canal abrió: se marca para pasarlo al final de las listas.
        StationStore.markFailed(this, current().optString("id"));
        if (failures >= 8 || list.size() == 1) {
            status.setText("Este canal no tiene señal ahora.\nPrueba más tarde o elige otro.");
            return;
        }
        status.setText("Sin señal · pasando al siguiente canal…");
        handler.postDelayed(() -> zap(direction), 1800);
    }

    private void zap(int dir) {
        if (list.size() < 2) return;
        direction = dir;
        index = (index + dir + list.size()) % list.size();
        handler.removeCallbacksAndMessages(null);
        playCurrent(true);
    }

    private final Runnable hideInfo = () -> info.animate().alpha(0f).setDuration(400).start();

    private void showInfo(String hint) {
        JSONObject ch = current();
        StringBuilder sb = new StringBuilder();
        sb.append(index + 1).append(" / ").append(list.size()).append("   ").append(ch.optString("name"));
        String sub = ch.optString("sub");
        if (!sub.isEmpty()) sb.append("\n").append(sub);
        if (hint != null) sb.append("\n").append(hint);
        info.setText(sb.toString());
        info.setAlpha(1f);
        handler.removeCallbacks(hideInfo);
        handler.postDelayed(hideInfo, hint != null ? 6000 : 4000);
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        if (e.getAction() == KeyEvent.ACTION_DOWN) {
            int k = e.getKeyCode();
            boolean controls = view.isControllerFullyVisible();
            if (k == KeyEvent.KEYCODE_CHANNEL_UP || (!controls && k == KeyEvent.KEYCODE_DPAD_UP)) { zap(-1); return true; }
            if (k == KeyEvent.KEYCODE_CHANNEL_DOWN || (!controls && k == KeyEvent.KEYCODE_DPAD_DOWN)) { zap(1); return true; }
            if (!controls && (k == KeyEvent.KEYCODE_DPAD_CENTER || k == KeyEvent.KEYCODE_ENTER)) {
                showInfo(null);
                view.showController();
                return true;
            }
            if (k == KeyEvent.KEYCODE_INFO) { showInfo(null); return true; }
        }
        return super.dispatchKeyEvent(e);
    }

    // ---------- imagen en imagen (solo celular/tableta) ----------
    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        if (!isTv && player != null && player.isPlaying()) {
            try {
                enterPictureInPictureMode(new PictureInPictureParams.Builder()
                        .setAspectRatio(new Rational(16, 9)).build());
            } catch (Exception ignored) { }
        }
    }

    @Override
    public void onPictureInPictureModeChanged(boolean inPip, Configuration newConfig) {
        super.onPictureInPictureModeChanged(inPip, newConfig);
        view.setUseController(!inPip);
        info.setVisibility(inPip ? View.GONE : View.VISIBLE);
        status.setVisibility(inPip ? View.GONE : View.VISIBLE);
    }

    @Override
    protected void onResume() {
        super.onResume();
        adHandler.removeCallbacks(midRoll);
        adHandler.postDelayed(midRoll, 60_000);
    }

    @Override
    protected void onStop() {
        super.onStop();
        adHandler.removeCallbacks(midRoll);
        // Al cerrar la ventanita o salir sin imagen en imagen, se detiene el video.
        if (player != null && !isInPictureInPictureMode()) player.pause();
    }

    @Override
    protected void onStart() {
        super.onStart();
        if (player != null && player.getPlaybackState() != Player.STATE_IDLE) {
            player.seekToDefaultPosition();
            player.play();
        }
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        adHandler.removeCallbacksAndMessages(null);
        if (player != null) {
            player.release();
            player = null;
        }
        super.onDestroy();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }
}
