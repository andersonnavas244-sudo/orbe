package com.orbesismos.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

import java.util.Iterator;

/** Preferencias compartidas: último canal visto, Premium y canales que fallan en este equipo. */
public final class StationStore {
    private static final String PREFS = "orbetv";

    private StationStore() { }

    private static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static void setLast(Context c, JSONObject ch) {
        if (ch != null) prefs(c).edit().putString("last", ch.toString()).apply();
    }

    public static JSONObject getLast(Context c) { return parse(prefs(c).getString("last", null)); }

    public static void setPremium(Context c, boolean on) { prefs(c).edit().putBoolean("premium", on).apply(); }

    public static boolean isPremium(Context c) { return prefs(c).getBoolean("premium", false); }

    // ---------- canales que no abren en este equipo ----------
    private static final long FAIL_TTL = 3L * 24 * 60 * 60 * 1000;   // se perdonan a los 3 días

    /** {id: [veces, últimaVez]} solo con fallos recientes. */
    public static JSONObject failed(Context c) {
        JSONObject all = parse(prefs(c).getString("failed", "{}"));
        if (all == null) all = new JSONObject();
        long now = System.currentTimeMillis();
        JSONObject out = new JSONObject();
        for (Iterator<String> it = all.keys(); it.hasNext(); ) {
            String id = it.next();
            org.json.JSONArray v = all.optJSONArray(id);
            if (v != null && now - v.optLong(1) < FAIL_TTL) {
                try { out.put(id, v); } catch (Exception ignored) { }
            }
        }
        return out;
    }

    public static void markFailed(Context c, String id) {
        if (id == null || id.isEmpty()) return;
        JSONObject f = failed(c);
        try {
            org.json.JSONArray v = f.optJSONArray(id);
            int n = v == null ? 0 : v.optInt(0);
            f.put(id, new org.json.JSONArray().put(n + 1).put(System.currentTimeMillis()));
        } catch (Exception ignored) { }
        prefs(c).edit().putString("failed", f.toString()).apply();
    }

    public static void markOk(Context c, String id) {
        JSONObject f = failed(c);
        if (f.has(id)) { f.remove(id); prefs(c).edit().putString("failed", f.toString()).apply(); }
    }

    public static JSONObject parse(String s) {
        if (s == null) return null;
        try { return new JSONObject(s); } catch (Exception e) { return null; }
    }
}
