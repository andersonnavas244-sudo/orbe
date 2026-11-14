package com.orbesismos.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Recordatorios de la mochila de emergencia: avisa 2 semanas antes de que se venza el agua, la comida,
 * las pilas o los medicamentos, y cada 6 meses para revisar la mochila y el plan familiar.
 * No usa internet: se revisa junto con los sismos (AlertEngine.check), como mucho cada 6 horas.
 */
public final class KitReminders {
    private KitReminders() { }

    private static final long DAY = 86_400_000L;
    private static final long EVERY = 6 * 3_600_000L;

    /** Lo guarda la interfaz: {items:[{n, exp}], review} (fechas en milisegundos). */
    public static void save(Context c, String json) {
        AlertEngine.prefs(c).edit().putString("kit", json).putLong("kitAt", 0).apply();
    }

    public static void check(Context c) {
        SharedPreferences p = AlertEngine.prefs(c);
        long now = System.currentTimeMillis();
        if (now - p.getLong("kitAt", 0) < EVERY) return;
        p.edit().putLong("kitAt", now).apply();
        JSONObject k;
        try { k = new JSONObject(p.getString("kit", "{}")); } catch (Exception e) { return; }
        Set<String> sent = new HashSet<>(p.getStringSet("kitSent", new HashSet<>()));
        SimpleDateFormat df = new SimpleDateFormat("d 'de' MMMM", Locale.forLanguageTag("es"));

        List<String> soon = new ArrayList<>();
        JSONArray items = k.optJSONArray("items");
        if (items != null) for (int i = 0; i < items.length(); i++) {
            JSONObject it = items.optJSONObject(i);
            if (it == null) continue;
            long exp = it.optLong("exp", 0);
            String name = it.optString("n", "");
            String key = name + "|" + exp;
            if (exp > 0 && now >= exp - 14 * DAY && !sent.contains(key)) {
                sent.add(key);
                soon.add(name.replaceAll("\\s*\\(.*\\)", "") + (exp < now ? " (vencido)" : " (" + df.format(new Date(exp)) + ")"));
            }
        }
        if (!soon.isEmpty()) {
            AlertEngine.notifyInfo(c, "🎒 Renueva tu mochila de emergencia",
                    "Se vence pronto: " + String.join(", ", soon) + ". Cámbialo para que esté listo cuando lo necesites.", "kit-exp");
        }

        long review = k.optLong("review", 0);
        if (review > 0 && now >= review && !sent.contains("review|" + review)) {
            sent.add("review|" + review);
            AlertEngine.notifyInfo(c, "🎒 Hora de revisar tu mochila y tu plan",
                    "Ya pasaron 6 meses: cambia el agua, revisa fechas de comida y medicamentos, prueba la linterna y actualiza los contactos del plan familiar.",
                    "kit-review");
        }
        if (sent.size() > 300) sent.clear();
        p.edit().putStringSet("kitSent", sent).apply();
    }
}
