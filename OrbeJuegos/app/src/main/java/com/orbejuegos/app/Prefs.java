package com.orbejuegos.app;

import android.content.Context;
import android.content.SharedPreferences;

/** Preferencias del teléfono: Premium. (Los marcadores y ajustes de los juegos los guarda la web en localStorage.) */
public final class Prefs {
    private static final String PREFS = "orbejuegos";

    private Prefs() { }

    static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static void setPremium(Context c, boolean on) { prefs(c).edit().putBoolean("premium", on).apply(); }

    public static boolean isPremium(Context c) { return prefs(c).getBoolean("premium", false); }
}
