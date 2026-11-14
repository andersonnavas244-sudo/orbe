package com.orberadio.app;

import android.Manifest;
import android.app.Activity;
import android.app.UiModeManager;
import android.content.res.Configuration;
import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.AssetManager;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;

import androidx.annotation.NonNull;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.Player;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;

import com.google.common.util.concurrent.ListenableFuture;

import org.json.JSONObject;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.Executor;

/**
 * Pantalla principal: WebView con el globo 3D (assets/www) + puente JavaScript ("AndroidRadio")
 * hacia el reproductor nativo, Chromecast, anuncios, compra Premium, alarma y compartir.
 */
public class MainActivity extends Activity {

    /** Dominio reservado por Android para servir assets locales con origen https. */
    private static final String ASSET_HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + ASSET_HOST + "/www/index.html";

    private final Handler main = new Handler(Looper.getMainLooper());
    private final Executor mainExecutor = main::post;

    private WebView web;
    private AdsManager ads;
    private BillingManager billing;
    private CastHelper cast;
    private ListenableFuture<MediaController> controllerFuture;
    private MediaController controller;
    private Runnable pendingAction;
    private JSONObject current;
    private String lastPushedState = "";
    private boolean pageReady;
    private boolean isTv;
    private long listeningSince = System.currentTimeMillis();

    /** Escuchando sin parar con la app abierta: un anuncio cada 20 min (máx. 2 cada 40 min). */
    private final Runnable midRoll = new Runnable() {
        @Override public void run() {
            AdsManager a = AdsManager.get();
            long now = System.currentTimeMillis();
            if (AdsConfig.MID_ROLL_EVERY_MS > 0 && a != null && !isTv && controller != null && controller.isPlaying()
                    && !cast.isCasting()
                    && now - listeningSince >= AdsConfig.MID_ROLL_EVERY_MS
                    && a.sinceLastAd() >= AdsConfig.MID_ROLL_EVERY_MS && a.canShow()) {
                controller.pause();
                a.showInterstitialThen(() -> {
                    listeningSince = System.currentTimeMillis();
                    withController(() -> { controller.seekToDefaultPosition(); controller.play(); });
                });
            }
            main.postDelayed(this, 60_000);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        UiModeManager ui = (UiModeManager) getSystemService(UI_MODE_SERVICE);
        isTv = ui != null && ui.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION;

        // Globo arriba (ocupa todo) y banner pequeño fijo abajo.
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(4, 6, 12));
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(4, 6, 12));
        root.addView(web, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));
        FrameLayout bannerBox = new FrameLayout(this);
        bannerBox.setVisibility(View.GONE);
        root.addView(bannerBox, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        setContentView(root);

        // Respeta la barra de estado y la de navegación (Android 15 dibuja de borde a borde).
        root.setOnApplyWindowInsetsListener((View v, WindowInsets insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                Insets i = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                v.setPadding(i.left, i.top, i.right, i.bottom);
            } else {
                v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                        insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        getWindow().setStatusBarColor(Color.rgb(4, 6, 12));
        getWindow().setNavigationBarColor(Color.rgb(4, 6, 12));

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setTextZoom(100);
        s.setOffscreenPreRaster(true);

        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (ASSET_HOST.equals(uri.getHost())) return serveAsset(uri.getPath());
                return null;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (ASSET_HOST.equals(uri.getHost())) return false;
                openExternal(uri);
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                pageReady = true;
            }
        });
        web.addJavascriptInterface(new Bridge(), "AndroidRadio");
        web.loadUrl(START_URL);
        if (isTv) {
            // En la TV todo se maneja con el control remoto: el WebView recibe las flechas.
            web.setFocusable(true);
            web.setFocusableInTouchMode(true);
            web.requestFocus();
        }

        ads = new AdsManager(this, bannerBox);
        // AdMob no admite apps de televisión: en la TV no hay anuncios.
        if (!isTv) ads.start();

        billing = new BillingManager(this, new BillingManager.Callback() {
            @Override public void onPremium(boolean premium, String price) {
                runOnUiThread(() -> {
                    if (premium) ads.disable();
                    js("window.onNativePremium && onNativePremium(" + premium + "," + JSONObject.quote(price) + ")");
                });
            }
            @Override public void onMessage(String msg) { toast(msg); }
        });
        billing.start();

        cast = new CastHelper(this, new CastHelper.Callback() {
            @Override public void onCastState(boolean connected, String name) {
                js("window.onNativeCast && onNativeCast(" + connected + "," + JSONObject.quote(name) + ")");
            }
            @Override public void onCastStarted() {
                if (controller != null) controller.pause();
                lastPushedState = "";
                pushState("playing", "");
            }
            @Override public void onCastEnded() {
                lastPushedState = "";
                pushState("paused", "");
            }
            @Override public JSONObject currentStation() { return current; }
        });

        // Buscar una lista de emisoras más nueva (se usará la próxima vez que se abra la app)
        CatalogUpdater.maybeUpdate(this, n -> toast("📡 Lista de emisoras actualizada: " + n + " emisoras. Se usará la próxima vez que abras la app."));

        PlaybackService.sleepListener = min -> js("window.onNativeSleep && onNativeSleep(" + min + ")");

        if (!isTv && Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1);
        }
        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIntent(intent);
    }

    /** Si se abrió desde el aviso de la alarma, enciende la emisora de la alarma. */
    private void handleIntent(Intent i) {
        if (i == null || !i.getBooleanExtra("alarm", false)) return;
        JSONObject st = StationStore.alarmStation(this);
        if (st != null) playNow(st);
    }

    // ---------- reproductor (Media3) ----------
    @Override
    protected void onStart() {
        super.onStart();
        SessionToken token = new SessionToken(this, new ComponentName(this, PlaybackService.class));
        controllerFuture = new MediaController.Builder(this, token).buildAsync();
        controllerFuture.addListener(() -> {
            try {
                controller = controllerFuture.get();
            } catch (Exception e) {
                return;
            }
            controller.addListener(playerListener);
            if (pendingAction != null) { pendingAction.run(); pendingAction = null; }
            // Si algo ya sonaba (widget, Android Auto, alarma), la interfaz lo muestra.
            JSONObject last = StationStore.getLast(this);
            if (controller.getMediaItemCount() > 0 && last != null) {
                current = last;
                js("window.onNativeStation && onNativeStation(" + JSONObject.quote(last.toString()) + ")");
            }
            lastPushedState = "";
            pushPlayer();
            pushMeta();
        }, mainExecutor);
    }

    @Override
    protected void onStop() {
        if (controller != null) controller.removeListener(playerListener);
        if (controllerFuture != null) MediaController.releaseFuture(controllerFuture);
        controller = null;
        super.onStop();
    }

    private final Player.Listener playerListener = new Player.Listener() {
        @Override public void onEvents(@NonNull Player player, @NonNull Player.Events events) { pushPlayer(); }
        @Override public void onMediaMetadataChanged(@NonNull MediaMetadata m) { pushMeta(); }
    };

    private void withController(Runnable r) {
        if (controller != null) r.run(); else pendingAction = r;
    }

    private void playNow(JSONObject st) {
        current = st;
        listeningSince = System.currentTimeMillis();
        StationStore.setLast(this, st);
        if (cast.isCasting()) {
            cast.load(st);
            lastPushedState = "";
            pushState("playing", "");
            return;
        }
        withController(() -> {
            controller.setMediaItem(StationStore.toMediaItem(st));
            controller.prepare();
            controller.play();
        });
    }

    private void pushPlayer() {
        if (controller == null || cast.isCasting()) return;
        String st;
        if (controller.getPlayerError() != null) st = "error";
        else if (controller.isPlaying()) st = "playing";
        else if (controller.getPlayWhenReady() && controller.getPlaybackState() == Player.STATE_BUFFERING) st = "loading";
        else if (controller.getMediaItemCount() == 0) st = "idle";
        else st = "paused";
        pushState(st, st.equals("error") ? "No se pudo reproducir esta emisora. Prueba otra." : "");
    }

    private void pushState(String state, String msg) {
        if (state.equals(lastPushedState)) return;
        lastPushedState = state;
        js("window.onNativePlayer && onNativePlayer(" + JSONObject.quote(state) + "," + JSONObject.quote(msg) + ")");
    }

    /** Título de la canción que envía la emisora (si lo envía). */
    private void pushMeta() {
        if (controller == null) return;
        MediaMetadata m = controller.getMediaMetadata();
        String station = current != null ? current.optString("name") : (m.station != null ? m.station.toString() : "");
        String title = m.title != null ? m.title.toString().trim() : "";
        if (title.equalsIgnoreCase(station.trim()) || title.length() < 2) title = "";
        js("window.onNativeMeta && onNativeMeta(" + JSONObject.quote(title) + ")");
    }

    // ---------- utilidades ----------
    private void js(String code) {
        runOnUiThread(() -> {
            if (web == null) return;
            if (!pageReady) { main.postDelayed(() -> js(code), 400); return; }
            web.evaluateJavascript(code, null);
        });
    }

    private void toast(String msg) {
        js("window.orbeToast && orbeToast(" + JSONObject.quote(msg) + ")");
    }

    private void openExternal(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (Exception ignored) { }
    }

    private WebResourceResponse serveAsset(String path) {
        if (path == null || path.equals("/")) path = "/www/index.html";
        String assetPath = path.startsWith("/") ? path.substring(1) : path;
        try {
            AssetManager am = getAssets();
            InputStream in;
            // Lista de emisoras descargada (si es más nueva que la incluida en el APK)
            if (assetPath.equals("www/data/stations.json") && CatalogUpdater.useDownloaded(MainActivity.this)) {
                in = new FileInputStream(CatalogUpdater.downloaded(MainActivity.this));
            } else {
                in = am.open(assetPath, AssetManager.ACCESS_STREAMING);
            }
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-cache");
            headers.put("Access-Control-Allow-Origin", "*");
            String mime = mimeFor(assetPath);
            String enc = mime.startsWith("text/") || mime.contains("json") || mime.contains("javascript") ? "utf-8" : null;
            return new WebResourceResponse(mime, enc, 200, "OK", headers, in);
        } catch (IOException e) {
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<>(), null);
        }
    }

    private static String mimeFor(String p) {
        String l = p.toLowerCase();
        if (l.endsWith(".html")) return "text/html";
        if (l.endsWith(".js")) return "application/javascript";
        if (l.endsWith(".css")) return "text/css";
        if (l.endsWith(".json") || l.endsWith(".geojson")) return "application/json";
        if (l.endsWith(".png")) return "image/png";
        if (l.endsWith(".jpg") || l.endsWith(".jpeg")) return "image/jpeg";
        if (l.endsWith(".svg")) return "image/svg+xml";
        if (l.endsWith(".webp")) return "image/webp";
        return "application/octet-stream";
    }

    /** Métodos llamados desde JavaScript (window.AndroidRadio). */
    private class Bridge {
        @JavascriptInterface
        public void playStation(String json, boolean withAd) {
            JSONObject st = StationStore.parse(json);
            if (st == null) return;
            runOnUiThread(() -> {
                lastPushedState = "";
                pushState("loading", "");
                if (withAd) ads.showInterstitialThen(() -> playNow(st));
                else playNow(st);
            });
        }

        @JavascriptInterface
        public void toggle() {
            runOnUiThread(() -> {
                if (cast.isCasting()) { cast.toggle(); return; }
                withController(() -> {
                    if (controller.isPlaying()) {
                        controller.pause();
                    } else {
                        // En vivo: al reanudar se conecta otra vez al directo.
                        if (controller.getPlaybackState() == Player.STATE_IDLE) controller.prepare();
                        else controller.seekToDefaultPosition();
                        controller.play();
                    }
                });
            });
        }

        @JavascriptInterface
        public void stop() {
            runOnUiThread(() -> withController(() -> controller.stop()));
        }

        @JavascriptInterface
        public void setSleep(int minutes) {
            Intent i = new Intent(MainActivity.this, PlaybackService.class)
                    .setAction(PlaybackService.ACTION_SLEEP).putExtra(PlaybackService.EXTRA_MINUTES, minutes);
            try { startService(i); } catch (Exception ignored) { }
        }

        @JavascriptInterface
        public String getAlarm() {
            JSONObject o = new JSONObject();
            try {
                o.put("on", StationStore.alarmOn(MainActivity.this));
                o.put("h", StationStore.alarmHour(MainActivity.this));
                o.put("m", StationStore.alarmMinute(MainActivity.this));
                JSONObject st = StationStore.alarmStation(MainActivity.this);
                o.put("name", st != null ? st.optString("name") : "");
            } catch (Exception ignored) { }
            return o.toString();
        }

        @JavascriptInterface
        public void setAlarm(int hour, int minute, String stationJson) {
            StationStore.setAlarm(MainActivity.this, true, hour, minute, StationStore.parse(stationJson));
            boolean exact = AlarmReceiver.schedule(MainActivity.this);
            if (!exact && Build.VERSION.SDK_INT >= 31) {
                toast("Activa \"Alarmas y recordatorios\" para que suene a la hora exacta");
                runOnUiThread(() -> {
                    try {
                        startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                                Uri.parse("package:" + getPackageName())));
                    } catch (Exception ignored) { }
                });
            }
        }

        @JavascriptInterface
        public void cancelAlarm() {
            StationStore.setAlarm(MainActivity.this, false, StationStore.alarmHour(MainActivity.this),
                    StationStore.alarmMinute(MainActivity.this), null);
            AlarmReceiver.schedule(MainActivity.this);
        }

        @JavascriptInterface
        public void share(String text) {
            runOnUiThread(() -> {
                Intent send = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text);
                for (String pkg : new String[]{"com.whatsapp", "com.whatsapp.w4b"}) {
                    try {
                        startActivity(new Intent(send).setPackage(pkg));
                        return;
                    } catch (ActivityNotFoundException ignored) { }
                }
                startActivity(Intent.createChooser(send, "Compartir emisora"));
            });
        }

        @JavascriptInterface
        public void cast() {
            runOnUiThread(() -> {
                if (!cast.showDialog()) toast("Chromecast no está disponible en este teléfono");
            });
        }

        @JavascriptInterface
        public void buyPremium() {
            runOnUiThread(() -> billing.buy());
        }

        @JavascriptInterface
        public void manageSubscription() {
            runOnUiThread(() -> openExternal(Uri.parse(billing.manageUrl())));
        }

        @JavascriptInterface
        public boolean isTv() {
            return isTv;
        }

        @JavascriptInterface
        public boolean isPremium() {
            return StationStore.isPremium(MainActivity.this);
        }

        @JavascriptInterface
        public void syncLibrary(String json) {
            StationStore.saveLibrary(MainActivity.this, json);
        }

        @JavascriptInterface
        public void openUrl(String url) {
            runOnUiThread(() -> openExternal(Uri.parse(url)));
        }
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.orbeBack ? window.orbeBack() : false", value -> {
            // Si la interfaz no lo gestionó, se va al fondo y la radio sigue sonando.
            if (!"true".equals(value)) moveTaskToBack(true);
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        ads.onResume();
        main.removeCallbacks(midRoll);
        main.postDelayed(midRoll, 60_000);
        // Al volver de los ajustes de "Alarmas y recordatorios", reprograma con precisión.
        if (StationStore.alarmOn(this)) AlarmReceiver.schedule(this);
    }

    @Override
    protected void onPause() {
        // Pausa el globo (ahorra batería); el audio es nativo y sigue sonando.
        main.removeCallbacks(midRoll);
        web.onPause();
        ads.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        PlaybackService.sleepListener = null;
        ads.onDestroy();
        billing.end();
        cast.release();
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
