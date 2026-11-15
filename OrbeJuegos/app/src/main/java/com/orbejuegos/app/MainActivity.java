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
import android.view.WindowInsetsController;
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
 * Pantalla principal de Juegos de Colombia: WebView (assets/www) con tejo, billar, parqués y dominó en 3D,
 * y el puente "AndroidJuegos" hacia lo nativo: anuncios entre partidas, compartir, vibrar y Premium.
 * Solo vertical, a pantalla completa (las barras del sistema se ocultan y vuelven deslizando desde el borde)
 * y con la pantalla encendida mientras la app está abierta.
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
        // Pantalla completa también junto a la cámara frontal (el juego usa toda la pantalla).
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(BG);
        web = new WebView(this);
        web.setBackgroundColor(BG);
        root.addView(web, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);
        // Solo se deja margen para el recorte de la cámara: las barras del sistema van ocultas y, cuando el jugador
        // las saca deslizando, aparecen por encima un momento sin mover el juego.
        root.setOnApplyWindowInsetsListener((View v, WindowInsets insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                Insets i = insets.getInsets(WindowInsets.Type.displayCutout());
                v.setPadding(i.left, i.top, i.right, i.bottom);
            } else if (Build.VERSION.SDK_INT >= 28 && insets.getDisplayCutout() != null) {
                android.view.DisplayCutout c = insets.getDisplayCutout();
                v.setPadding(c.getSafeInsetLeft(), c.getSafeInsetTop(), c.getSafeInsetRight(), c.getSafeInsetBottom());
            } else v.setPadding(0, 0, 0, 0);
            return insets;
        });
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);
        pantallaCompleta();

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

    /** Modo inmersivo: oculta la barra de estado y la de navegación; vuelven un momento al deslizar desde el borde. */
    @SuppressWarnings("deprecation")
    private void pantallaCompleta() {
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_FULLSCREEN);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) pantallaCompleta();      // al volver de un anuncio, de compartir o de otra app
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
    @Override protected void onResume() { super.onResume(); pantallaCompleta(); if (web != null) web.onResume(); }
    @Override protected void onPause() { if (web != null) web.onPause(); super.onPause(); }

    @Override
    protected void onDestroy() {
        billing.end();
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }
}
