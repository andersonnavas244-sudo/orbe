package com.orbeespacio.app;

import android.content.Context;
import android.content.SharedPreferences;

/** Preferencias compartidas: Premium. */
public final class StationStore {
    private static final String PREFS = "orbeespacio";

    private StationStore() { }

    static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static void setPremium(Context c, boolean on) { prefs(c).edit().putBoolean("premium", on).apply(); }

    public static boolean isPremium(Context c) { return prefs(c).getBoolean("premium", false); }
}
