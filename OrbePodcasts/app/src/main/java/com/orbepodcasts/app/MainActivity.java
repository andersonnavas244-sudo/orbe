package com.orbepodcasts.app;

import android.Manifest;
import android.app.Activity;
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
import androidx.media3.common.C;
import androidx.media3.common.PlaybackParameters;
import androidx.media3.common.Player;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;

import com.google.common.util.concurrent.ListenableFuture;

import org.json.JSONObject;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.Executor;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Pantalla principal de Orbe Podcasts: WebView con el globo 3D (assets/www) y el puente
 * "AndroidPod" hacia el reproductor nativo (Media3), Chromecast, anuncios y Premium.
 */
public class MainActivity extends Activity {

    private static final String ASSET_HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + ASSET_HOST + "/www/index.html";

    private final Handler main = new Handler(Looper.getMainLooper());
    private final Executor mainExecutor = main::post;
    private final ExecutorService io = Executors.newFixedThreadPool(4);

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
    private float speed = 1f;
    private long listeningSince = System.currentTimeMillis();

    /** Envía a la interfaz la posición del episodio cada segundo (barra de progreso). */
    private final Runnable progressTick = new Runnable() {
        @Override public void run() {
            pushProgress();
            main.postDelayed(this, 1000);
        }
    };

    /** Escuchando sin parar con la app abierta: un anuncio cada 20 min (máx. 2 cada 40 min). */
    private final Runnable midRoll = new Runnable() {
        @Override public void run() {
            AdsManager a = AdsManager.get();
            long now = System.currentTimeMillis();
            if (AdsConfig.MID_ROLL_EVERY_MS > 0 && a != null && controller != null && controller.isPlaying() && !cast.isCasting()
                    && now - listeningSince >= AdsConfig.MID_ROLL_EVERY_MS && a.sinceLastAd() >= AdsConfig.MID_ROLL_EVERY_MS && a.canShow()) {
                controller.pause();
                a.showInterstitialThen(() -> {
                    listeningSince = System.currentTimeMillis();
                    withController(() -> controller.play());       // sigue exactamente donde iba
                });
            }
            main.postDelayed(this, 60_000);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(3, 5, 12));
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(3, 5, 12));
        root.addView(web, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));
        FrameLayout bannerBox = new FrameLayout(this);
        bannerBox.setVisibility(View.GONE);
        root.addView(bannerBox, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        setContentView(root);
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
        getWindow().setStatusBarColor(Color.rgb(3, 5, 12));
        getWindow().setNavigationBarColor(Color.rgb(3, 5, 12));

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
            public void onPageFinished(WebView view, String url) { pageReady = true; }
        });
        web.addJavascriptInterface(new Bridge(), "AndroidPod");
        web.loadUrl(START_URL);

        ads = new AdsManager(this, bannerBox);
        ads.start();
        billing = new BillingManager(this, new BillingManager.Callback() {
            @Override public void onPremium(boolean premium, String price) {
                runOnUiThread(() -> {
                    if (premium) ads.disable();
                    js("window.onNativePremium && onNativePremium(" + premium + "," + JSONObject.quote(price == null ? "" : price) + ")");
                });
            }
            @Override public void onMessage(String msg) { toast(msg); }
        });
        billing.start();

        cast = new CastHelper(this, new CastHelper.Callback() {
            @Override public void onCastState(boolean connected, String name) {
                js("window.onNativeCast && onNativeCast(" + connected + "," + JSONObject.quote(name) + ")");
            }
            @Override public void onCastStarted() { if (controller != null) controller.pause(); lastPushedState = ""; pushState("playing", ""); }
            @Override public void onCastEnded() { lastPushedState = ""; pushState("paused", ""); }
            @Override public JSONObject currentEpisode() { return current; }
            @Override public long currentPosition() { return controller != null ? controller.getCurrentPosition() : 0; }
        });

        PlaybackService.sleepListener = min -> js("window.onNativeSleep && onNativeSleep(" + min + ")");
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1);
        }
    }

    // ---------- reproductor (Media3) ----------
    @Override
    protected void onStart() {
        super.onStart();
        SessionToken token = new SessionToken(this, new ComponentName(this, PlaybackService.class));
        controllerFuture = new MediaController.Builder(this, token).buildAsync();
        controllerFuture.addListener(() -> {
            try { controller = controllerFuture.get(); } catch (Exception e) { return; }
            controller.addListener(playerListener);
            if (pendingAction != null) { pendingAction.run(); pendingAction = null; }
            // Si algo ya sonaba (Android Auto, auriculares, notificación), la interfaz lo muestra.
            JSONObject last = StationStore.getLast(this);
            if (controller.getMediaItemCount() > 0 && last != null) {
                current = last;
                js("window.onNativeEpisode && onNativeEpisode(" + JSONObject.quote(last.toString()) + ")");
            }
            lastPushedState = "";
            pushPlayer();
        }, mainExecutor);
        main.removeCallbacks(progressTick);
        main.post(progressTick);
    }

    @Override
    protected void onStop() {
        main.removeCallbacks(progressTick);
        if (controller != null) controller.removeListener(playerListener);
        if (controllerFuture != null) MediaController.releaseFuture(controllerFuture);
        controller = null;
        super.onStop();
    }

    private final Player.Listener playerListener = new Player.Listener() {
        @Override public void onEvents(@NonNull Player player, @NonNull Player.Events events) { pushPlayer(); }
    };

    private void withController(Runnable r) { if (controller != null) r.run(); else pendingAction = r; }

    private void playNow(JSONObject ep, long startMs) {
        current = ep;
        listeningSince = System.currentTimeMillis();
        StationStore.setLast(this, ep);
        long start = startMs >= 0 ? startMs : StationStore.position(this, ep.optString("id"));
        if (cast.isCasting()) { cast.load(ep, start); lastPushedState = ""; pushState("playing", ""); return; }
        withController(() -> {
            controller.setMediaItem(StationStore.toMediaItem(ep), start);
            controller.setPlaybackParameters(new PlaybackParameters(speed));
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
        else if (controller.getPlaybackState() == Player.STATE_ENDED) st = "ended";
        else if (controller.getMediaItemCount() == 0) st = "idle";
        else st = "paused";
        pushState(st, st.equals("error") ? "No se pudo reproducir este episodio. Revisa tu conexión o prueba otro." : "");
    }

    private void pushState(String state, String msg) {
        if (state.equals(lastPushedState)) return;
        lastPushedState = state;
        js("window.onNativePlayer && onNativePlayer(" + JSONObject.quote(state) + "," + JSONObject.quote(msg) + ")");
    }

    private void pushProgress() {
        long pos, dur; boolean playing;
        long[] cp = cast.isCasting() ? cast.progress() : null;
        if (cp != null) { pos = cp[0]; dur = cp[1]; playing = cp[2] == 1; }
        else if (controller != null && controller.getMediaItemCount() > 0) {
            pos = controller.getCurrentPosition();
            dur = controller.getDuration() == C.TIME_UNSET ? 0 : controller.getDuration();
            playing = controller.isPlaying();
        } else return;
        if (!pageReady) return;
        web.evaluateJavascript("window.onNativeProgress && onNativeProgress(" + pos + "," + dur + "," + playing + ")", null);
    }

    // ---------- utilidades ----------
    private void js(String code) {
        runOnUiThread(() -> {
            if (web == null) return;
            if (!pageReady) { main.postDelayed(() -> js(code), 400); return; }
            web.evaluateJavascript(code, null);
        });
    }

    private void toast(String msg) { js("window.orbeToast && orbeToast(" + JSONObject.quote(msg) + ")"); }

    private void openExternal(Uri uri) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) { }
    }

    private WebResourceResponse serveAsset(String path) {
        if (path == null || path.equals("/")) path = "/www/index.html";
        String assetPath = path.startsWith("/") ? path.substring(1) : path;
        try {
            InputStream in = getAssets().open(assetPath, AssetManager.ACCESS_STREAMING);
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-cache");
            String l = assetPath.toLowerCase();
            String mime = l.endsWith(".html") ? "text/html" : l.endsWith(".js") ? "application/javascript" : l.endsWith(".css") ? "text/css"
                    : l.endsWith(".json") || l.endsWith(".geojson") ? "application/json" : l.endsWith(".png") ? "image/png"
                    : l.endsWith(".jpg") ? "image/jpeg" : l.endsWith(".woff2") ? "font/woff2" : l.endsWith(".svg") ? "image/svg+xml"
                    : l.endsWith(".webp") ? "image/webp" : "application/octet-stream";
            String enc = mime.startsWith("text/") || mime.contains("json") || mime.contains("javascript") ? "utf-8" : null;
            return new WebResourceResponse(mime, enc, 200, "OK", headers, in);
        } catch (IOException e) {
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<>(), null);
        }
    }

    /** Métodos llamados desde JavaScript (window.AndroidPod). */
    private class Bridge {
        /** Descarga un texto (episodios, búsquedas, listas) con caché en el teléfono. */
        @JavascriptInterface
        public void fetchText(String url, int id, int maxAgeMin) {
            if (!url.startsWith("https://") && !url.startsWith("http://")) { js("__orbeFetched(" + id + ",false,'url no permitida')"); return; }
            io.execute(() -> {
                try {
                    String body = Net.cached(MainActivity.this, url, maxAgeMin);
                    js("__orbeFetched(" + id + ",true," + JSONObject.quote(body) + ")");
                } catch (Exception e) {
                    js("__orbeFetched(" + id + ",false," + JSONObject.quote(String.valueOf(e.getMessage())) + ")");
                }
            });
        }

        /** Reproduce un episodio desde startMs (−1 = donde quedó la última vez). */
        @JavascriptInterface
        public void playEpisode(String json, double startMs, boolean withAd) {
            JSONObject ep = StationStore.parse(json);
            if (ep == null) return;
            runOnUiThread(() -> {
                lastPushedState = "";
                pushState("loading", "");
                if (withAd) ads.showInterstitialThen(() -> playNow(ep, (long) startMs));
                else playNow(ep, (long) startMs);
            });
        }

        @JavascriptInterface
        public void toggle() {
            runOnUiThread(() -> {
                if (cast.isCasting()) { cast.toggle(); return; }
                withController(() -> {
                    if (controller.isPlaying()) controller.pause();
                    else {
                        if (controller.getPlaybackState() == Player.STATE_IDLE) controller.prepare();
                        if (controller.getPlaybackState() == Player.STATE_ENDED) controller.seekTo(0);
                        controller.play();
                    }
                });
            });
        }

        @JavascriptInterface
        public void seekTo(double ms) {
            runOnUiThread(() -> { if (cast.isCasting()) cast.seekTo((long) ms); else withController(() -> controller.seekTo((long) ms)); pushProgress(); });
        }

        @JavascriptInterface
        public void skip(double deltaMs) {
            runOnUiThread(() -> {
                if (cast.isCasting()) { cast.seekBy((long) deltaMs); return; }
                withController(() -> {
                    long d = controller.getDuration();
                    long to = Math.max(0, controller.getCurrentPosition() + (long) deltaMs);
                    if (d != C.TIME_UNSET) to = Math.min(to, d - 500);
                    controller.seekTo(to);
                });
                pushProgress();
            });
        }

        @JavascriptInterface
        public void setSpeed(double s) {
            speed = (float) Math.max(0.5, Math.min(3, s));
            runOnUiThread(() -> withController(() -> controller.setPlaybackParameters(new PlaybackParameters(speed))));
        }

        /** Minutos para apagarse; −1 = al terminar el episodio; 0 = quitar. */
        @JavascriptInterface
        public void setSleep(int minutes) {
            Intent i = new Intent(MainActivity.this, PlaybackService.class)
                    .setAction(PlaybackService.ACTION_SLEEP).putExtra(PlaybackService.EXTRA_MINUTES, minutes);
            try { startService(i); } catch (Exception ignored) { }
        }

        /** Dónde quedó cada episodio: {id: ms, …} (−1 = terminado). */
        @JavascriptInterface public String positions() { return StationStore.positions(MainActivity.this); }

        @JavascriptInterface public void syncLibrary(String json) { StationStore.saveLibrary(MainActivity.this, json); }

        @JavascriptInterface
        public void share(String text) {
            runOnUiThread(() -> {
                Intent send = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text);
                for (String pkg : new String[]{"com.whatsapp", "com.whatsapp.w4b"}) {
                    try { startActivity(new Intent(send).setPackage(pkg)); return; } catch (ActivityNotFoundException ignored) { }
                }
                startActivity(Intent.createChooser(send, "Compartir"));
            });
        }

        @JavascriptInterface
        public void cast() { runOnUiThread(() -> { if (!cast.showDialog()) toast("Chromecast no está disponible en este teléfono"); }); }

        @JavascriptInterface public void openUrl(String url) { runOnUiThread(() -> openExternal(Uri.parse(url))); }
        @JavascriptInterface public void openLink(String url) { runOnUiThread(() -> ads.showInterstitialThen(() -> openExternal(Uri.parse(url)))); }
        @JavascriptInterface public void buyPremium() { runOnUiThread(() -> billing.buy()); }
        @JavascriptInterface public void manageSubscription() { runOnUiThread(() -> openExternal(Uri.parse(billing.manageUrl()))); }
        @JavascriptInterface public boolean isPremium() { return StationStore.isPremium(MainActivity.this); }
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.orbeBack ? window.orbeBack() : false", value -> {
            // Si la interfaz no lo gestionó, la app se va al fondo y el podcast sigue sonando.
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
    }

    @Override
    protected void onPause() {
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
        io.shutdown();
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }
}
