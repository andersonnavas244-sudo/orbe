package com.orbejuegos.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.res.AssetManager;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import org.json.JSONObject;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * Pantalla principal de Juegos de Colombia: WebView (assets/www) con el Tejo 3D y el Billar 3D,
 * y el puente "AndroidJuegos" hacia lo nativo: anuncios entre partidas, compartir, vibrar y Premium.
 * Solo vertical y con la pantalla encendida mientras la app está abierta.
 */
public class MainActivity extends Activity {

    private static final String ASSET_HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + ASSET_HOST + "/www/index.html";
    private static final int BG = Color.rgb(13, 8, 24);

    private final Handler main = new Handler(Looper.getMainLooper());
    private WebView web;
    private AdsManager ads;
    private BillingManager billing;
    private boolean pageReady;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Mientras se juega la pantalla no se apaga.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(BG);
        web = new WebView(this);
        web.setBackgroundColor(BG);
        root.addView(web, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
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
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setTextZoom(100);
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
        web.addJavascriptInterface(new Bridge(), "AndroidJuegos");
        web.loadUrl(START_URL);

        ads = new AdsManager(this);
        ads.start();
        billing = new BillingManager(this, new BillingManager.Callback() {
            @Override public void onPremium(boolean premium, String price) {
                runOnUiThread(() -> {
                    if (premium) ads.disable();
                    js("window.onNativePremium && onNativePremium(" + premium + "," + JSONObject.quote(price == null ? "" : price) + ")");
                });
            }
            @Override public void onMessage(String msg) { js("window.orbeToast && orbeToast(" + JSONObject.quote(msg) + ")"); }
        });
        billing.start();
    }

    private void js(String code) {
        runOnUiThread(() -> {
            if (web == null) return;
            if (!pageReady) { main.postDelayed(() -> js(code), 400); return; }
            web.evaluateJavascript(code, null);
        });
    }

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
                    : l.endsWith(".json") ? "application/json" : l.endsWith(".png") ? "image/png"
                    : l.endsWith(".jpg") ? "image/jpeg" : l.endsWith(".woff2") ? "font/woff2" : l.endsWith(".svg") ? "image/svg+xml"
                    : l.endsWith(".webp") ? "image/webp" : "application/octet-stream";
            String enc = mime.startsWith("text/") || mime.contains("json") || mime.contains("javascript") ? "utf-8" : null;
            return new WebResourceResponse(mime, enc, 200, "OK", headers, in);
        } catch (IOException e) {
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<>(), null);
        }
    }

    private Vibrator vibrator() {
        if (Build.VERSION.SDK_INT >= 31) {
            VibratorManager vm = (VibratorManager) getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            return vm == null ? null : vm.getDefaultVibrator();
        }
        return (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
    }

    /** Métodos llamados desde JavaScript (window.AndroidJuegos). */
    private class Bridge {
        /** Pausa publicitaria entre partidas (respeta el límite de 2 cada 40 minutos). */
        @JavascriptInterface
        public void adBreak() { runOnUiThread(() -> { if (ads.canShow()) ads.showInterstitialThen(() -> { }); }); }

        /** Comparte el resultado de la partida (WhatsApp, Facebook, etc.). */
        @JavascriptInterface
        public void share(String texto) {
            runOnUiThread(() -> {
                Intent send = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, texto);
                try { startActivity(Intent.createChooser(send, "Compartir resultado")); } catch (Exception ignored) { }
            });
        }

        @JavascriptInterface public void openUrl(String url) { runOnUiThread(() -> openExternal(Uri.parse(url))); }

        @JavascriptInterface public void buyPremium() { runOnUiThread(() -> billing.buy()); }
        @JavascriptInterface public void manageSubscription() { runOnUiThread(() -> openExternal(Uri.parse(billing.manageUrl()))); }
        @JavascriptInterface public boolean isPremium() { return Prefs.isPremium(MainActivity.this); }

        /** Vibración corta (la web ya respeta el ajuste "Vibración"). */
        @JavascriptInterface
        public void vibrate(int ms) {
            int d = Math.max(1, Math.min(ms, 1000));
            try {
                Vibrator v = vibrator();
                if (v == null || !v.hasVibrator()) return;
                v.vibrate(VibrationEffect.createOneShot(d, VibrationEffect.DEFAULT_AMPLITUDE));
            } catch (Exception ignored) { }
        }
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.orbeBack ? window.orbeBack() : false", value -> {
            if (!"true".equals(value)) finish();
        });
    }

    // Sin pauseTimers(): pausaría también el WebView del anuncio a pantalla completa. La web se pausa sola (visibilitychange).
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override protected void onPause() { if (web != null) web.onPause(); super.onPause(); }

    @Override
    protected void onDestroy() {
        billing.end();
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }
}
