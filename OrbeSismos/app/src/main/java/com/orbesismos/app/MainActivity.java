package com.orbesismos.app;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.AssetManager;
import android.graphics.Color;
import android.graphics.Insets;
import android.location.Location;
import android.location.LocationManager;
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

import org.json.JSONObject;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Pantalla principal de Orbe Sismos: WebView con el globo 3D (assets/www) y el puente
 * "AndroidSismos" hacia las funciones nativas (red, ubicación, alarmas, SOS, llamadas…).
 */
public class MainActivity extends Activity {

    private static final String ASSET_HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + ASSET_HOST + "/www/index.html";
    private static final int REQ_LOCATION = 11, REQ_NOTIF = 12;

    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService io = Executors.newFixedThreadPool(4);
    private WebView web;
    private AdsManager ads;
    private BillingManager billing;
    private boolean pageReady;
    private String pendingQuake;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(4, 6, 12));
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(4, 6, 12));
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
                if (pendingQuake != null) {
                    String q = pendingQuake; pendingQuake = null;
                    main.postDelayed(() -> js("window.orbeOpenQuake && orbeOpenQuake(" + JSONObject.quote(q) + ")"), 2500);
                }
            }
        });
        web.addJavascriptInterface(new Bridge(), "AndroidSismos");
        web.loadUrl(START_URL);

        ads = new AdsManager(this, bannerBox);
        ads.start();
        billing = new BillingManager(this, new BillingManager.Callback() {
            @Override public void onPremium(boolean premium, String price) {
                runOnUiThread(() -> { if (premium) ads.disable(); js("window.onNativePremium && onNativePremium(" + premium + ")"); });
            }
            @Override public void onMessage(String msg) { js("window.orbeToast && orbeToast(" + JSONObject.quote(msg) + ")"); }
        });
        billing.start();

        AlertEngine.ensureChannels(this);
        AlertWorker.schedule(this);
        if (AlertEngine.hasLocation(AlertEngine.settings(this))) WatchService.sync(this);
        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIntent(intent);
    }

    /** Si se abrió desde una alarma, muestra ese sismo. */
    private void handleIntent(Intent i) {
        String q = i == null ? null : i.getStringExtra("quake");
        if (q == null) return;
        if (pageReady) js("window.orbeOpenQuake && orbeOpenQuake(" + JSONObject.quote(q) + ")");
        else pendingQuake = q;
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
                    : l.endsWith(".json") || l.endsWith(".geojson") ? "application/json" : l.endsWith(".png") ? "image/png"
                    : l.endsWith(".jpg") ? "image/jpeg" : "application/octet-stream";
            String enc = mime.startsWith("text/") || mime.contains("json") || mime.contains("javascript") ? "utf-8" : null;
            return new WebResourceResponse(mime, enc, 200, "OK", headers, in);
        } catch (IOException e) {
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<>(), null);
        }
    }

    // ---------- ubicación ----------
    private void locate() {
        if (checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_LOCATION);
            return;
        }
        LocationManager lm = getSystemService(LocationManager.class);
        Location best = null;
        for (String prov : lm.getProviders(true)) {
            try {
                Location l = lm.getLastKnownLocation(prov);
                if (l != null && (best == null || l.getTime() > best.getTime())) best = l;
            } catch (SecurityException ignored) { }
        }
        if (best != null && System.currentTimeMillis() - best.getTime() < 6L * 3600 * 1000) {
            sendLocation(best);
            return;
        }
        String prov = lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER) ? LocationManager.NETWORK_PROVIDER : LocationManager.GPS_PROVIDER;
        try {
            if (Build.VERSION.SDK_INT >= 30) {
                lm.getCurrentLocation(prov, null, getMainExecutor(), l -> {
                    if (l != null) sendLocation(l); else js("window.__orbeLocation && __orbeLocation(null)");
                });
            } else {
                final Location fallback = best;
                lm.requestSingleUpdate(prov, this::sendLocation, Looper.getMainLooper());
                main.postDelayed(() -> { if (fallback != null) sendLocation(fallback); }, 15000);
            }
        } catch (Exception e) {
            if (best != null) sendLocation(best); else js("window.__orbeLocation && __orbeLocation(null)");
        }
    }

    private void sendLocation(Location l) {
        js("window.__orbeLocation && __orbeLocation(" + l.getLatitude() + "," + l.getLongitude() + ")");
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] res) {
        super.onRequestPermissionsResult(code, perms, res);
        if (code == REQ_LOCATION) {
            if (res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED) locate();
            else js("window.__orbeLocation && __orbeLocation(null)");
        }
    }

    private void askNotifications() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIF);
        }
    }

    /** Métodos llamados desde JavaScript (window.AndroidSismos). */
    private class Bridge {
        /** Descarga un texto (sismos, tsunamis, volcanes, noticias) y lo devuelve a la interfaz. */
        @JavascriptInterface
        public void fetchText(String url, int id) {
            if (!url.startsWith("https://")) { js("__orbeFetched(" + id + ",false,'url no permitida')"); return; }
            io.execute(() -> {
                try {
                    String body = AlertEngine.get(url);
                    js("__orbeFetched(" + id + ",true," + JSONObject.quote(body) + ")");
                } catch (Exception e) {
                    js("__orbeFetched(" + id + ",false," + JSONObject.quote(String.valueOf(e.getMessage())) + ")");
                }
            });
        }

        /** Comparte la tarjeta del sismo (PNG en base64) por WhatsApp u otra app. */
        @JavascriptInterface
        public void shareImage(String base64Png, String text) {
            io.execute(() -> {
                try {
                    java.io.File dir = new java.io.File(getCacheDir(), "compartir");
                    dir.mkdirs();
                    java.io.File f = new java.io.File(dir, "sismo.png");
                    try (java.io.FileOutputStream out = new java.io.FileOutputStream(f)) {
                        out.write(android.util.Base64.decode(base64Png, android.util.Base64.DEFAULT));
                    }
                    Uri uri = androidx.core.content.FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".archivos", f);
                    runOnUiThread(() -> {
                        Intent send = new Intent(Intent.ACTION_SEND).setType("image/png")
                                .putExtra(Intent.EXTRA_STREAM, uri).putExtra(Intent.EXTRA_TEXT, text)
                                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        for (String pkg : new String[]{"com.whatsapp", "com.whatsapp.w4b"}) {
                            try { startActivity(new Intent(send).setPackage(pkg)); return; } catch (ActivityNotFoundException ignored) { }
                        }
                        startActivity(Intent.createChooser(send, "Compartir sismo"));
                    });
                } catch (Exception e) {
                    js("window.orbeToast && orbeToast('No se pudo compartir la imagen')");
                }
            });
        }

        @JavascriptInterface public void requestLocation() { runOnUiThread(MainActivity.this::locate); }

        @JavascriptInterface
        public void setAlertSettings(String json) {
            AlertEngine.saveSettings(MainActivity.this, json);
            runOnUiThread(() -> {
                try {
                    if (AlertEngine.hasLocation(new JSONObject(json))) {
                        askNotifications();
                        WatchService.sync(MainActivity.this);
                    }
                } catch (Exception ignored) { }
            });
        }

        @JavascriptInterface public void testAlarm() { askNotifications(); AlertEngine.test(MainActivity.this); }

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

        /** Abre el marcador con el número listo (no llama solo: la persona confirma). */
        @JavascriptInterface
        public void dial(String number) {
            runOnUiThread(() -> { try { startActivity(new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + number))); } catch (Exception ignored) { } });
        }

        @JavascriptInterface public void openUrl(String url) { runOnUiThread(() -> openExternal(Uri.parse(url))); }

        /** Noticias: puede mostrar un anuncio antes (nunca en alarmas ni en Seguridad). */
        @JavascriptInterface
        public void openNews(String url) { runOnUiThread(() -> ads.showInterstitialThen(() -> openExternal(Uri.parse(url)))); }

        @JavascriptInterface
        public void openSettings() {
            runOnUiThread(() -> {
                for (String action : new String[]{"android.settings.SAFETY_CENTER", Settings.ACTION_LOCATION_SOURCE_SETTINGS, Settings.ACTION_SETTINGS}) {
                    try { startActivity(new Intent(action)); return; } catch (Exception ignored) { }
                }
            });
        }

        /** ¿Android deja a Orbe Sismos funcionar en segundo plano sin restricciones de batería? */
        @JavascriptInterface public boolean isBatteryFree() { return BatteryHelper.isFree(MainActivity.this); }

        /** Marca del teléfono (xiaomi, samsung…), para mostrar los pasos correctos. */
        @JavascriptInterface public String brand() { return BatteryHelper.brand(); }

        @JavascriptInterface public void openBatterySettings() { runOnUiThread(() -> BatteryHelper.openOptimization(MainActivity.this)); }

        @JavascriptInterface public void openAutostart() { runOnUiThread(() -> BatteryHelper.openAutostart(MainActivity.this)); }

        @JavascriptInterface public void sosStart() { SosHelper.start(MainActivity.this, true); }
        @JavascriptInterface public void sosStop() { SosHelper.stop(MainActivity.this); }
        /** Sirena del simulacro (sin linterna). */
        @JavascriptInterface public void alarm(boolean on) { if (on) SosHelper.start(MainActivity.this, false); else SosHelper.stop(MainActivity.this); }

        /** Modo apagón: linterna fija encendida o apagada. */
        @JavascriptInterface public void torch(boolean on) { SosHelper.setTorch(getApplicationContext(), on); }

        /** Abre los mensajes de texto con el texto listo; la persona elige a quién enviarlo. */
        @JavascriptInterface
        public void sms(String body) {
            runOnUiThread(() -> {
                try { startActivity(new Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:")).putExtra("sms_body", body)); }
                catch (Exception e) { share(body); }
            });
        }

        /** Fechas de vencimiento de la mochila y revisión cada 6 meses. */
        @JavascriptInterface
        public void setKitReminders(String json) {
            KitReminders.save(MainActivity.this, json);
            if (json.contains("\"exp\"") || !json.contains("\"review\":0")) runOnUiThread(MainActivity.this::askNotifications);
        }

        @JavascriptInterface public void buyPremium() { runOnUiThread(() -> billing.buy()); }
        @JavascriptInterface public boolean isPremium() { return StationStore.isPremium(MainActivity.this); }
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.orbeBack ? window.orbeBack() : false", value -> {
            if (!"true".equals(value)) finish();
        });
    }

    @Override
    protected void onResume() {
        super.onResume(); web.onResume(); ads.onResume();
        // Al volver de los ajustes de batería, la interfaz actualiza el estado
        if (pageReady) js("window.orbeResume && orbeResume()");
    }
    @Override protected void onPause() { web.onPause(); ads.onPause(); super.onPause(); }

    @Override
    protected void onDestroy() {
        SosHelper.stop(this);
        ads.onDestroy();
        billing.end();
        io.shutdown();
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }
}
