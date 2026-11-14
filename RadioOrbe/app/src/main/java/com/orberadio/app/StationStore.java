package com.orberadio.app;

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
 * Datos que comparten la app, el widget, la alarma y Android Auto:
 * última emisora, favoritos, recientes, alarma y estado Premium.
 * Una emisora es un JSON {id, name, url, sub, img, cc}.
 */
public final class StationStore {
    private static final String PREFS = "orbe";

    private StationStore() { }

    private static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    // ---------- última emisora ----------
    public static void setLast(Context c, JSONObject st) {
        if (st != null) prefs(c).edit().putString("last", st.toString()).apply();
    }

    public static JSONObject getLast(Context c) { return parse(prefs(c).getString("last", null)); }

    // ---------- favoritos y recientes (los envía la interfaz web) ----------
    public static void saveLibrary(Context c, String json) { prefs(c).edit().putString("library", json).apply(); }

    public static List<JSONObject> favorites(Context c) { return list(c, "favs"); }

    public static List<JSONObject> recents(Context c) { return list(c, "recents"); }

    private static List<JSONObject> list(Context c, String key) {
        List<JSONObject> out = new ArrayList<>();
        JSONObject lib = parse(prefs(c).getString("library", null));
        if (lib == null) return out;
        JSONArray arr = lib.optJSONArray(key);
        if (arr == null) return out;
        for (int i = 0; i < arr.length(); i++) {
            JSONObject o = arr.optJSONObject(i);
            if (o != null && o.optString("url").length() > 0) out.add(o);
        }
        return out;
    }

    /** Busca una emisora por id en todo lo que conoce el teléfono. */
    public static JSONObject find(Context c, String id, List<JSONObject> extra) {
        if (id == null) return null;
        JSONObject last = getLast(c);
        if (last != null && id.equals(last.optString("id"))) return last;
        for (JSONObject o : favorites(c)) if (id.equals(o.optString("id"))) return o;
        for (JSONObject o : recents(c)) if (id.equals(o.optString("id"))) return o;
        if (extra != null) for (JSONObject o : extra) if (id.equals(o.optString("id"))) return o;
        return null;
    }

    // ---------- alarma ----------
    public static void setAlarm(Context c, boolean on, int hour, int minute, JSONObject st) {
        SharedPreferences.Editor e = prefs(c).edit()
                .putBoolean("alarm_on", on).putInt("alarm_h", hour).putInt("alarm_m", minute);
        if (st != null) e.putString("alarm_station", st.toString());
        e.apply();
    }

    public static boolean alarmOn(Context c) { return prefs(c).getBoolean("alarm_on", false); }
    public static int alarmHour(Context c) { return prefs(c).getInt("alarm_h", 7); }
    public static int alarmMinute(Context c) { return prefs(c).getInt("alarm_m", 0); }
    public static JSONObject alarmStation(Context c) { return parse(prefs(c).getString("alarm_station", null)); }

    // ---------- premium ----------
    public static void setPremium(Context c, boolean on) { prefs(c).edit().putBoolean("premium", on).apply(); }
    public static boolean isPremium(Context c) { return prefs(c).getBoolean("premium", false); }

    // ---------- conversión a MediaItem (Media3) ----------
    public static MediaItem toMediaItem(JSONObject st) {
        String url = st.optString("url");
        String img = st.optString("img");
        Bundle extras = new Bundle();
        extras.putString("json", st.toString());
        MediaMetadata.Builder md = new MediaMetadata.Builder()
                .setTitle(st.optString("name"))
                .setArtist(st.optString("sub"))
                .setStation(st.optString("name"))
                .setAlbumTitle("Orbe Radio")
                .setIsBrowsable(false)
                .setIsPlayable(true)
                .setMediaType(MediaMetadata.MEDIA_TYPE_RADIO_STATION)
                .setExtras(extras);
        if (img.startsWith("http")) md.setArtworkUri(Uri.parse(img));
        MediaItem.Builder b = new MediaItem.Builder()
                .setMediaId(st.optString("id", url))
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
