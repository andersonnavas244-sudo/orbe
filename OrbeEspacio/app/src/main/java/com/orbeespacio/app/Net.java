package com.orbeespacio.app;

import android.content.Context;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.zip.GZIPInputStream;

/**
 * Descargas con caché en el teléfono. Así el catálogo de satélites (≈7 MB) se baja como mucho
 * una vez cada 12 horas, se respetan los límites de los servicios gratuitos y la app abre al
 * instante, incluso sin internet (usa la última copia guardada).
 */
public final class Net {
    private Net() { }

    public static String get(String url) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(60000);
        c.setRequestProperty("User-Agent", "OrbeEspacio/1.1 (+https://github.com/andersonnavas244-sudo/orbe)");
        c.setRequestProperty("Accept-Encoding", "gzip");
        try {
            int code = c.getResponseCode();
            if (code < 200 || code >= 300) throw new IOException("HTTP " + code);
            InputStream in = c.getInputStream();
            if ("gzip".equalsIgnoreCase(c.getContentEncoding())) in = new GZIPInputStream(in);
            return read(in);
        } finally {
            c.disconnect();
        }
    }

    /**
     * Devuelve la copia guardada si tiene menos de {@code maxAgeMin} minutos; si no, descarga.
     * Si la descarga falla, devuelve la copia vieja (mejor datos de ayer que nada).
     */
    public static String cached(Context ctx, String url, int maxAgeMin) throws IOException {
        File dir = new File(ctx.getCacheDir(), "datos");
        dir.mkdirs();
        File f = new File(dir, hash(url));
        long age = System.currentTimeMillis() - f.lastModified();
        if (maxAgeMin > 0 && f.exists() && age < maxAgeMin * 60_000L) return readFile(f);
        try {
            String body = get(url);
            if (maxAgeMin > 0 && body.length() > 0) {
                File tmp = new File(dir, f.getName() + ".tmp");
                try (FileOutputStream out = new FileOutputStream(tmp)) { out.write(body.getBytes(StandardCharsets.UTF_8)); }
                if (!tmp.renameTo(f)) { f.delete(); tmp.renameTo(f); }
            }
            return body;
        } catch (IOException e) {
            if (f.exists()) return readFile(f);
            throw e;
        }
    }

    private static String readFile(File f) throws IOException {
        try (InputStream in = new FileInputStream(f)) { return read(in); }
    }

    private static String read(InputStream in) throws IOException {
        try (InputStream is = in) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[32768];
            int n;
            while ((n = is.read(buf)) > 0) out.write(buf, 0, n);
            return out.toString("UTF-8");
        }
    }

    private static String hash(String s) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-1").digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder b = new StringBuilder();
            for (byte x : d) b.append(String.format("%02x", x));
            return b.toString();
        } catch (Exception e) {
            return Integer.toHexString(s.hashCode());
        }
    }
}
