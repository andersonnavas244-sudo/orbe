package com.orbepodcasts.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;

import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Datos guardados en el teléfono: Premium, último episodio, dónde quedó cada episodio
 * (para seguir escuchando) y la biblioteca que se muestra en Android Auto.
 * Un episodio es un JSON: {id, title, podcast, podId, art, url, dur}.
 */
public final class StationStore {
    private static final String PREFS = "orbepodcasts";

    private StationStore() { }

    static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static void setPremium(Context c, boolean on) { prefs(c).edit().putBoolean("premium", on).apply(); }

    public static boolean isPremium(Context c) { return prefs(c).getBoolean("premium", false); }

    public static void setLast(Context c, JSONObject ep) {
        if (ep != null) prefs(c).edit().putString("last", ep.toString()).apply();
    }

    public static JSONObject getLast(Context c) { return parse(prefs(c).getString("last", null)); }

    // ---------- posición de cada episodio ----------
    public static void savePosition(Context c, String id, long ms, long dur) {
        if (id == null || id.isEmpty()) return;
        JSONObject all = parse(prefs(c).getString("pos", "{}"));
        if (all == null) all = new JSONObject();
        try {
            // Terminado (o casi): se marca con -1 para mostrarlo como escuchado
            all.put(id, dur > 0 && dur - ms < 30_000 ? -1 : ms);
            // Solo se guardan los 300 más recientes
            if (all.length() > 300) all.remove(all.keys().next());
        } catch (Exception ignored) { }
        prefs(c).edit().putString("pos", all.toString()).apply();
    }

    public static long position(Context c, String id) {
        JSONObject all = parse(prefs(c).getString("pos", "{}"));
        return all == null ? 0 : Math.max(0, all.optLong(id, 0));
    }

    public static String positions(Context c) { return prefs(c).getString("pos", "{}"); }

    // ---------- biblioteca para Android Auto (la envía la interfaz) ----------
    public static void saveLibrary(Context c, String json) { prefs(c).edit().putString("library", json).apply(); }

    public static List<JSONObject> library(Context c, String key) {
        List<JSONObject> out = new ArrayList<>();
        JSONObject lib = parse(prefs(c).getString("library", "{}"));
        JSONArray arr = lib == null ? null : lib.optJSONArray(key);
        if (arr != null) for (int i = 0; i < arr.length(); i++) { JSONObject o = arr.optJSONObject(i); if (o != null) out.add(o); }
        return out;
    }

    public static JSONObject find(Context c, String id) {
        JSONObject last = getLast(c);
        if (last != null && id.equals(last.optString("id"))) return last;
        for (String k : new String[]{"recents", "nuevos"}) for (JSONObject o : library(c, k)) if (id.equals(o.optString("id"))) return o;
        return null;
    }

    public static MediaItem toMediaItem(JSONObject ep) {
        String url = ep.optString("url");
        String img = ep.optString("art");
        Bundle extras = new Bundle();
        extras.putString("json", ep.toString());
        MediaMetadata.Builder md = new MediaMetadata.Builder()
                .setTitle(ep.optString("title"))
                .setArtist(ep.optString("podcast"))
                .setAlbumTitle(ep.optString("podcast"))
                .setIsBrowsable(false)
                .setIsPlayable(true)
                .setMediaType(MediaMetadata.MEDIA_TYPE_PODCAST_EPISODE)
                .setExtras(extras);
        if (img.startsWith("http")) md.setArtworkUri(Uri.parse(img));
        MediaItem.Builder b = new MediaItem.Builder()
                .setMediaId(ep.optString("id", url))
                .setMediaMetadata(md.build())
                .setRequestMetadata(new MediaItem.RequestMetadata.Builder().setMediaUri(Uri.parse(url)).build())
                .setUri(url);
        if (url.toLowerCase().contains(".m3u8")) b.setMimeType("application/x-mpegURL");
        return b.build();
    }

    public static JSONObject parse(String s) {
        if (s == null) return null;
        try { return new JSONObject(s); } catch (Exception e) { return null; }
    }
}
