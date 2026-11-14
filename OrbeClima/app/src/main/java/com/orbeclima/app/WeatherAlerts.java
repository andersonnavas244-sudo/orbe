package com.orbeclima.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Locale;

/**
 * Alertas del clima para tus lugares (hasta 3): lluvia muy fuerte, tormentas eléctricas, viento fuerte,
 * calor o frío extremos (según el pronóstico de MET Norway) y ciclones tropicales cerca (GDACS).
 * Se revisa cada hora en segundo plano con WorkManager; cada alerta se avisa una sola vez.
 */
public final class WeatherAlerts {
    private WeatherAlerts() { }

    static final String CH_ALERT = "alertas_clima";
    static final String CH_STORM = "huracanes";
    private static final Locale ES = Locale.forLanguageTag("es");

    static SharedPreferences prefs(Context c) { return StationStore.prefs(c); }

    public static void saveSettings(Context c, String json) { prefs(c).edit().putString("alerts", json).apply(); }

    public static JSONObject settings(Context c) {
        try { return new JSONObject(prefs(c).getString("alerts", "{}")); } catch (Exception e) { return new JSONObject(); }
    }

    static void ensureChannels(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm.getNotificationChannel(CH_ALERT) == null) {
            NotificationChannel ch = new NotificationChannel(CH_ALERT, "Alertas del clima", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Lluvia muy fuerte, tormentas, viento, calor y frío extremos en tus lugares");
            nm.createNotificationChannel(ch);
        }
        if (nm.getNotificationChannel(CH_STORM) == null) {
            NotificationChannel ch = new NotificationChannel(CH_STORM, "Huracanes cerca", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Huracanes, tifones y tormentas tropicales cerca de tus lugares");
            nm.createNotificationChannel(ch);
        }
    }

    /** Revisa el pronóstico y los ciclones; avisa lo nuevo. Se llama desde el trabajo periódico. */
    public static void check(Context c) {
        JSONObject s = settings(c);
        JSONArray places = s.optJSONArray("places");
        if (places == null || places.length() == 0) return;
        ensureChannels(c);
        for (int i = 0; i < places.length(); i++) {
            JSONObject p = places.optJSONObject(i);
            if (p == null) continue;
            try { checkForecast(c, s, p); } catch (Exception ignored) { }
        }
        if (s.optBoolean("hurricane", true)) {
            try { checkStorms(c, s, places); } catch (Exception ignored) { }
        }
    }

    private static void checkForecast(Context c, JSONObject s, JSONObject p) throws Exception {
        double lat = p.getDouble("lat"), lng = p.getDouble("lng");
        String name = p.optString("name", "tu lugar");
        // Pronóstico de MET Norway (gratis, uso comercial permitido): próximas 24 horas, hora a hora
        String url = ClimaConfig.MET_FORECAST + String.format(Locale.US, "?lat=%.3f&lon=%.3f", lat, lng);
        JSONObject j = new JSONObject(Net.cached(c, url, 50));
        JSONArray ts = j.getJSONObject("properties").getJSONArray("timeseries");
        double sum = 0, maxRate = 0, maxGust = 0, tmax = -1e9, tmin = 1e9;
        int storm = -1;
        for (int i = 0; i < Math.min(24, ts.length()); i++) {
            JSONObject data = ts.getJSONObject(i).getJSONObject("data");
            JSONObject inst = data.getJSONObject("instant").getJSONObject("details");
            tmax = Math.max(tmax, inst.optDouble("air_temperature", -1e9));
            tmin = Math.min(tmin, inst.optDouble("air_temperature", 1e9));
            // Ráfagas (si el modelo las da; si no, el viento medio con un margen)
            double gust = inst.has("wind_speed_of_gust") ? inst.optDouble("wind_speed_of_gust") : inst.optDouble("wind_speed", 0) * 1.5;
            maxGust = Math.max(maxGust, gust * 3.6);
            JSONObject n1 = data.optJSONObject("next_1_hours");
            if (n1 == null) continue;
            double r = n1.optJSONObject("details") != null ? n1.getJSONObject("details").optDouble("precipitation_amount", 0) : 0;
            sum += r;
            maxRate = Math.max(maxRate, r);
            String sym = n1.optJSONObject("summary") != null ? n1.getJSONObject("summary").optString("symbol_code") : "";
            if (storm < 0 && i < 12 && sym.contains("thunder")) storm = i;
        }
        // Una clave por día (UTC) para no repetir la misma alerta
        String day = ts.getJSONObject(0).optString("time").substring(0, 10);
        String key = name + "|" + day;
        if (s.optBoolean("rain", true) && (sum >= 50 || maxRate >= 15))
            notifyOnce(c, CH_ALERT, "rain|" + key, "🌧️ Lluvia muy fuerte en " + name,
                    String.format(ES, "Se esperan %.0f mm en las próximas 24 horas (hasta %.0f mm en una hora). Ten cuidado con inundaciones y deslizamientos.", sum, maxRate));
        if (s.optBoolean("storm", true) && storm >= 0)
            notifyOnce(c, CH_ALERT, "storm|" + key, "⛈️ Tormenta eléctrica en " + name,
                    "Se pronostican tormentas con rayos " + (storm <= 1 ? "en la próxima hora" : "en las próximas " + storm + " horas")
                            + ". Busca refugio bajo techo y aléjate de árboles y postes.");
        if (s.optBoolean("wind", true) && maxGust >= 70)
            notifyOnce(c, CH_ALERT, "wind|" + key, "💨 Viento fuerte en " + name,
                    String.format(ES, "Ráfagas de hasta %.0f km/h en las próximas 24 horas. Asegura objetos sueltos.", maxGust));
        if (s.optBoolean("heat", true) && tmax >= 38)
            notifyOnce(c, CH_ALERT, "heat|" + key, "🌡️ Calor extremo en " + name,
                    String.format(ES, "Máxima de %.0f °C. Toma agua, evita el sol del mediodía y cuida a niños y adultos mayores.", tmax));
        if (s.optBoolean("cold", true) && tmin <= -5)
            notifyOnce(c, CH_ALERT, "cold|" + key, "🥶 Frío extremo en " + name,
                    String.format(ES, "Mínima de %.0f °C. Abrígate y protege las tuberías.", tmin));
    }

    private static void checkStorms(Context c, JSONObject s, JSONArray places) throws Exception {
        JSONObject j = new JSONObject(Net.cached(c, "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC", 50));
        JSONArray f = j.optJSONArray("features");
        if (f == null) return;
        double radius = s.optDouble("radius", 600);
        for (int i = 0; i < f.length(); i++) {
            JSONObject ev = f.optJSONObject(i);
            JSONObject pr = ev == null ? null : ev.optJSONObject("properties");
            if (pr == null || !"true".equals(pr.optString("iscurrent"))) continue;
            JSONObject g = ev.optJSONObject("geometry");
            JSONArray co = g == null ? null : g.optJSONArray("coordinates");
            if (co == null) continue;
            double slng = co.optDouble(0), slat = co.optDouble(1);
            for (int k = 0; k < places.length(); k++) {
                JSONObject p = places.optJSONObject(k);
                if (p == null) continue;
                double dkm = distKm(slat, slng, p.optDouble("lat"), p.optDouble("lng"));
                if (dkm > radius) continue;
                String name = pr.optString("eventname", "").replaceAll("-\\d+$", "");
                JSONObject sev = pr.optJSONObject("severitydata");
                String wind = sev == null ? "" : String.format(ES, " Vientos de hasta %.0f km/h.", sev.optDouble("severity"));
                notifyOnce(c, CH_STORM, "tc|" + pr.optString("eventid") + "|" + pr.optString("episodeid") + "|" + p.optString("name"),
                        "🌀 Ciclón tropical " + name + " a " + Math.round(dkm) + " km de " + p.optString("name"),
                        "Alerta " + level(pr.optString("alertlevel")) + " de GDACS." + wind + " Sigue las indicaciones de las autoridades de tu país.");
            }
        }
    }

    private static String level(String l) {
        return "Red".equals(l) ? "roja" : "Orange".equals(l) ? "naranja" : "verde";
    }

    static double distKm(double aLat, double aLng, double bLat, double bLng) {
        double r = Math.PI / 180;
        double x = Math.pow(Math.sin((bLat - aLat) * r / 2), 2) + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.pow(Math.sin((bLng - aLng) * r / 2), 2);
        return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(x)));
    }

    private static void notifyOnce(Context c, String channel, String key, String title, String text) {
        SharedPreferences sp = prefs(c);
        String seen = sp.getString("seen", "");
        if (seen.contains("[" + key + "]")) return;
        if (seen.length() > 6000) seen = seen.substring(seen.length() - 3000);
        sp.edit().putString("seen", seen + "[" + key + "]").apply();
        show(c, channel, title, text, key.hashCode());
    }

    static void show(Context c, String channel, String title, String text, int id) {
        ensureChannels(c);
        Intent open = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP)
                .putExtra("open", CH_STORM.equals(channel) ? "huracanes" : "alertas");
        PendingIntent pi = PendingIntent.getActivity(c, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification n = new Notification.Builder(c, channel)
                .setSmallIcon(R.drawable.ic_notification)
                .setColor(0xFF4F8CFF)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setCategory(Notification.CATEGORY_RECOMMENDATION)
                .setAutoCancel(true)
                .setContentIntent(pi)
                .build();
        c.getSystemService(NotificationManager.class).notify(id, n);
    }

    /** Notificación de prueba desde la sección Alertas. */
    public static void test(Context c) {
        show(c, CH_ALERT, "🌧️ Prueba de alerta de Orbe Clima",
                "Así te avisaremos si viene lluvia muy fuerte, tormentas, viento fuerte o un huracán cerca de tus lugares.", 4242);
    }
}
