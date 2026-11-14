package com.orbetv.app;

import android.app.Activity;
import android.app.UiModeManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.res.AssetManager;
import android.content.res.Configuration;
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

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Pantalla principal de Orbe TV: WebView con el globo 3D (assets/www) + puente JavaScript
 * ("AndroidRadio", el mismo nombre que en Orbe Radio) hacia el reproductor de video,
 * Chromecast, anuncios y la suscripción Premium.
 */
public class MainActivity extends Activity {

    private static final String ASSET_HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + ASSET_HOST + "/www/index.html";

    private final Handler main = new Handler(Looper.getMainLooper());
    private WebView web;
    private AdsManager ads;
    private BillingManager billing;
    private CastHelper cast;
    private JSONObject current;
    private boolean pageReady, isTv;

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
            public void onPageFinished(WebView view, String url) { pageReady = true; }
        });
        web.addJavascriptInterface(new Bridge(), "AndroidRadio");
        web.loadUrl(START_URL);
        if (isTv) {
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
            @Override public void onCastStarted() { }
            @Override public void onCastEnded() { }
            @Override public JSONObject currentStation() { return current; }
        });

        // Buscar una lista de canales más nueva (se usará la próxima vez que se abra la app)
        CatalogUpdater.maybeUpdate(this, n -> toast("📡 Lista de canales actualizada: " + n + " canales. Se usará la próxima vez que abras la app."));

        PlayerActivity.listener = ch -> {
            current = ch;
            js("window.onNativeStation && onNativeStation(" + JSONObject.quote(ch.toString()) + ")");
        };
    }

    /** Abre el reproductor con la lista y el canal elegido (o lo manda a la TV si hay Chromecast). */
    private void openPlayer(List<JSONObject> list, int index) {
        current = list.get(index);
        StationStore.setLast(this, current);
        if (cast.isCasting()) {
            cast.load(current);
            toast("📺 Enviado a la TV");
            return;
        }
        PlayerActivity.pendingList = list;
        PlayerActivity.pendingIndex = index;
        startActivity(new Intent(this, PlayerActivity.class).addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT));
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
            AssetManager am = getAssets();
            InputStream in;
            // Lista de canales descargada (si es más nueva que la incluida en el APK)
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
        /** listJson: arreglo de canales {id,name,url,sub,img,cc,streams:[[url,ua,referer],…]}. */
        @JavascriptInterface
        public void playChannel(String listJson, int index, boolean withAd) {
            List<JSONObject> list = new ArrayList<>();
            try {
                JSONArray arr = new JSONArray(listJson);
                for (int i = 0; i < arr.length(); i++) list.add(arr.getJSONObject(i));
            } catch (Exception e) {
                return;
            }
            if (list.isEmpty()) return;
            int idx = Math.max(0, Math.min(index, list.size() - 1));
            runOnUiThread(() -> {
                if (withAd) ads.showInterstitialThen(() -> openPlayer(list, idx));
                else openPlayer(list, idx);
            });
        }

        @JavascriptInterface
        public void share(String text) {
            runOnUiThread(() -> {
                Intent send = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text);
                for (String pkg : new String[]{"com.whatsapp", "com.whatsapp.w4b"}) {
                    try { startActivity(new Intent(send).setPackage(pkg)); return; } catch (ActivityNotFoundException ignored) { }
                }
                startActivity(Intent.createChooser(send, "Compartir canal"));
            });
        }

        @JavascriptInterface
        public void cast() {
            runOnUiThread(() -> { if (!cast.showDialog()) toast("Chromecast no está disponible en este equipo"); });
        }

        @JavascriptInterface public void buyPremium() { runOnUiThread(() -> billing.buy()); }
        @JavascriptInterface public void manageSubscription() { runOnUiThread(() -> openExternal(Uri.parse(billing.manageUrl()))); }
        @JavascriptInterface public boolean isPremium() { return StationStore.isPremium(MainActivity.this); }
        @JavascriptInterface public boolean isTv() { return isTv; }
        @JavascriptInterface public String getFailed() { return StationStore.failed(MainActivity.this).toString(); }
        @JavascriptInterface public void openUrl(String url) { runOnUiThread(() -> openExternal(Uri.parse(url))); }
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.orbeBack ? window.orbeBack() : false", value -> {
            if (!"true".equals(value)) finish();
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        ads.onResume();
        // Al volver del reproductor, la interfaz recibe qué canales no abrieron
        js("window.onNativeFailed && onNativeFailed(" + JSONObject.quote(StationStore.failed(this).toString()) + ")");
    }

    @Override
    protected void onPause() {
        web.onPause();
        ads.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        PlayerActivity.listener = null;
        ads.onDestroy();
        billing.end();
        cast.release();
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }
}
