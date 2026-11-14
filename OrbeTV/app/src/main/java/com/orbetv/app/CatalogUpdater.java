package com.orbetv.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Lista de canales que se actualiza sola.
 *
 * Al abrir la app (como máximo cada 12 horas) descarga en segundo plano la lista publicada en
 * {@link #CATALOG_URL}. Si es válida y más nueva que la que trae el APK, se guarda y se usa
 * desde la próxima vez que se abra la app. Sin internet, o si algo falla, se sigue usando la
 * lista incluida en el APK.
 */
public final class CatalogUpdater {

    /**
     * Dirección donde se publica la lista cada semana (la tarea de GitHub en
     * .github/workflows/actualizar-canales.yml). Ejemplo:
     * "https://andersonnavas244-sudo.github.io/orbe/tv/stations.json"
     * Vacía = no se descarga nada y se usa solo la lista incluida en el APK.
     */
    public static final String CATALOG_URL = "https://andersonnavas244-sudo.github.io/orbe/tv/stations.json";

    private static final long MIN_INTERVAL_MS = 12L * 60 * 60 * 1000;
    private static final int MIN_CHANNELS = 1000;   // una lista con menos canales se considera dañada
    private static final Pattern GENERATED = Pattern.compile("\"generated\"\\s*:\\s*\"([^\"]+)\"");

    public interface Callback { void onUpdated(int channels); }

    private CatalogUpdater() { }

    private static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences("orbetv_catalog", Context.MODE_PRIVATE);
    }

    public static File downloaded(Context c) { return new File(c.getFilesDir(), "stations.json"); }

    /** Fecha de creación de una lista (se lee del principio del archivo, sin cargarlo entero). */
    static String generatedOf(InputStream in) {
        try (InputStream is = in) {
            byte[] head = new byte[400];
            int n = is.read(head);
            if (n <= 0) return "";
            Matcher m = GENERATED.matcher(new String(head, 0, n, StandardCharsets.UTF_8));
            return m.find() ? m.group(1) : "";
        } catch (Exception e) {
            return "";
        }
    }

    /** true si hay una lista descargada más nueva que la incluida en el APK. */
    public static boolean useDownloaded(Context c) {
        File f = downloaded(c);
        if (!f.exists()) return false;
        String dl = prefs(c).getString("generated", "");
        String bundled;
        try { bundled = generatedOf(c.getAssets().open("www/data/stations.json")); } catch (Exception e) { bundled = ""; }
        return dl.compareTo(bundled) > 0;   // fechas ISO: se comparan como texto
    }

    public static void maybeUpdate(Context c, Callback cb) {
        if (CATALOG_URL.isEmpty()) return;
        SharedPreferences p = prefs(c);
        if (System.currentTimeMillis() - p.getLong("checked", 0) < MIN_INTERVAL_MS) return;
        Context app = c.getApplicationContext();
        new Thread(() -> {
            HttpURLConnection conn = null;
            File tmp = new File(app.getFilesDir(), "stations.json.tmp");
            try {
                conn = (HttpURLConnection) new URL(CATALOG_URL).openConnection();
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(60000);
                conn.setRequestProperty("User-Agent", "OrbeTV/1.0 (Android)");
                String etag = p.getString("etag", "");
                if (!etag.isEmpty() && downloaded(app).exists()) conn.setRequestProperty("If-None-Match", etag);
                int code = conn.getResponseCode();
                p.edit().putLong("checked", System.currentTimeMillis()).apply();
                if (code != 200) return;                         // 304 = sin cambios
                try (InputStream in = conn.getInputStream(); OutputStream out = new FileOutputStream(tmp)) {
                    byte[] buf = new byte[64 * 1024];
                    int n;
                    while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                }
                // Validar antes de usarla
                JSONObject json = new JSONObject(new String(Files.readAllBytes(tmp.toPath()), StandardCharsets.UTF_8));
                int rows = json.getJSONArray("rows").length();
                String generated = json.optString("generated", "");
                if (rows < MIN_CHANNELS || generated.isEmpty() || !json.getJSONArray("fields").toString().contains("streams")) {
                    tmp.delete();
                    return;
                }
                File dest = downloaded(app);
                if (dest.exists()) dest.delete();
                if (!tmp.renameTo(dest)) { tmp.delete(); return; }
                p.edit().putString("etag", conn.getHeaderField("ETag") == null ? "" : conn.getHeaderField("ETag"))
                        .putString("generated", generated).apply();
                if (cb != null) cb.onUpdated(rows);
            } catch (Exception e) {
                tmp.delete();
            } finally {
                if (conn != null) conn.disconnect();
            }
        }).start();
    }
}
