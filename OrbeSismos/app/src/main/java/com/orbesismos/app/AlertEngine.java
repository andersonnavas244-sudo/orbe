package com.orbesismos.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.RingtoneManager;

import org.json.JSONArray;
import org.json.JSONObject;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TimeZone;

import javax.xml.parsers.DocumentBuilderFactory;

/**
 * Motor de alarmas de Orbe Sismos.
 *
 * Revisa los sismos publicados por USGS (EE. UU.) y EMSC (Europa) y los boletines oficiales de
 * tsunami (NOAA). Si hay un sismo nuevo de la magnitud elegida a la distancia elegida, hace
 * sonar una alarma. IMPORTANTE: los sismos se conocen cuando estos centros los publican
 * (normalmente 1 a 5 minutos después); ninguna app puede avisar antes de que ocurra un sismo.
 */
public final class AlertEngine {

    static final String CH_ALARM = "alarma_sismo";
    static final String CH_INFO = "avisos";
    static final String CH_WATCH = "vigilancia";
    private static final long MAX_AGE_MS = 2L * 60 * 60 * 1000;          // no avisar de sismos de hace más de 2 h
    private static final long TSUNAMI_EVERY_MS = 5L * 60 * 1000;

    private AlertEngine() { }

    // ---------- ajustes (los guarda la interfaz web) ----------
    static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences("sismos", Context.MODE_PRIVATE);
    }

    static JSONObject settings(Context c) {
        try { return new JSONObject(prefs(c).getString("settings", "{}")); } catch (Exception e) { return new JSONObject(); }
    }

    static void saveSettings(Context c, String json) { prefs(c).edit().putString("settings", json).apply(); }

    static boolean hasLocation(JSONObject s) {
        JSONArray pl = s.optJSONArray("places");
        return (s.has("lat") && s.has("lon")) || (pl != null && pl.length() > 0);
    }

    /** Lugares vigilados: casa, trabajo, familia (o la ubicación única de versiones anteriores). */
    static List<double[]> placeCoords(JSONObject s) {
        List<double[]> out = new ArrayList<>();
        JSONArray pl = s.optJSONArray("places");
        if (pl != null) for (int i = 0; i < pl.length(); i++) {
            JSONObject o = pl.optJSONObject(i);
            if (o != null) out.add(new double[]{o.optDouble("lat"), o.optDouble("lon")});
        }
        if (out.isEmpty() && s.has("lat")) out.add(new double[]{s.optDouble("lat"), s.optDouble("lon")});
        return out;
    }

    static String placeName(JSONObject s, int i) {
        JSONArray pl = s.optJSONArray("places");
        if (pl != null && i < pl.length()) {
            JSONObject o = pl.optJSONObject(i);
            String label = o.optString("label", ""), name = o.optString("name", "");
            return label.equals("Casa") || label.isEmpty() ? name : name + " (" + label.toLowerCase(Locale.ROOT) + ")";
        }
        return s.optString("name", "tu ubicación");
    }

    // ---------- canales de notificación ----------
    static void ensureChannels(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm.getNotificationChannel(CH_ALARM) == null) {
            NotificationChannel a = new NotificationChannel(CH_ALARM, "Alarma de sismo y tsunami", NotificationManager.IMPORTANCE_HIGH);
            a.setDescription("Suena como alarma cuando hay un sismo fuerte cerca o un boletín de tsunami");
            a.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM),
                    new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            a.enableVibration(true);
            a.setVibrationPattern(new long[]{0, 900, 300, 900, 300, 900, 300, 1500});
            a.enableLights(true);
            a.setLightColor(Color.RED);
            a.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(a);
        }
        if (nm.getNotificationChannel(CH_INFO) == null) {
            nm.createNotificationChannel(new NotificationChannel(CH_INFO, "Sismos fuertes en el mundo", NotificationManager.IMPORTANCE_DEFAULT));
        }
        if (nm.getNotificationChannel(CH_WATCH) == null) {
            NotificationChannel w = new NotificationChannel(CH_WATCH, "Vigilancia en tiempo real", NotificationManager.IMPORTANCE_MIN);
            w.setShowBadge(false);
            nm.createNotificationChannel(w);
        }
    }

    // ---------- red ----------
    static String get(String url) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setConnectTimeout(12000);
        conn.setReadTimeout(20000);
        // MET Norway exige identificar la app (nombre + dirección del proyecto)
        conn.setRequestProperty("User-Agent", "OrbeSismos/1.5 (+https://github.com/andersonnavas244-sudo/orbe)");
        try (InputStream in = conn.getInputStream()) {
            java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
            byte[] buf = new byte[16384];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        } finally {
            conn.disconnect();
        }
    }

    static double distKm(double aLat, double aLon, double bLat, double bLon) {
        double r = Math.PI / 180, x = Math.pow(Math.sin((bLat - aLat) * r / 2), 2)
                + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.pow(Math.sin((bLon - aLon) * r / 2), 2);
        return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(x)));
    }

    /** Sismo simple. */
    static final class Q {
        String id, place, src, url;
        double mag, lat, lon, depth;
        long time;
        boolean tsunami;

        JSONObject json() {
            JSONObject o = new JSONObject();
            try {
                o.put("id", id).put("place", place).put("src", src).put("url", url).put("mag", mag).put("lat", lat)
                        .put("lon", lon).put("depth", depth).put("time", time).put("tsunami", tsunami);
            } catch (Exception ignored) { }
            return o;
        }
    }

    static String esPlace(String p) {
        if (p == null) return "Lugar sin nombre";
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("^(\\d+(?:\\.\\d+)?) km ([NSEW]{1,3}) of (.+)$").matcher(p);
        if (m.find()) return m.group(1) + " km al " + m.group(2).replace('W', 'O') + " de " + m.group(3);
        return p;
    }

    static List<Q> fetchQuakes(double minMagEmsc) {
        List<Q> out = new ArrayList<>();
        try {
            JSONArray f = new JSONObject(get("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson")).getJSONArray("features");
            for (int i = 0; i < f.length(); i++) {
                JSONObject e = f.getJSONObject(i), p = e.getJSONObject("properties");
                JSONArray g = e.getJSONObject("geometry").getJSONArray("coordinates");
                Q q = new Q();
                q.id = "us:" + e.getString("id"); q.mag = p.optDouble("mag", 0); q.time = p.optLong("time");
                q.place = esPlace(p.optString("place")); q.url = p.optString("url"); q.src = "USGS";
                q.tsunami = p.optInt("tsunami", 0) == 1; q.lon = g.getDouble(0); q.lat = g.getDouble(1); q.depth = g.optDouble(2, 0);
                out.add(q);
            }
        } catch (Exception ignored) { }
        try {
            SimpleDateFormat iso = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US);
            iso.setTimeZone(TimeZone.getTimeZone("UTC"));
            String start = iso.format(new java.util.Date(System.currentTimeMillis() - MAX_AGE_MS));
            JSONArray f = new JSONObject(get("https://www.seismicportal.eu/fdsnws/event/1/query?format=json&limit=300&minmag="
                    + minMagEmsc + "&starttime=" + start)).getJSONArray("features");
            SimpleDateFormat t = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US);
            t.setTimeZone(TimeZone.getTimeZone("UTC"));
            for (int i = 0; i < f.length(); i++) {
                JSONObject p = f.getJSONObject(i).getJSONObject("properties");
                Q q = new Q();
                q.id = "em:" + p.optString("unid"); q.mag = p.optDouble("mag", 0); q.lat = p.optDouble("lat"); q.lon = p.optDouble("lon");
                q.depth = p.optDouble("depth", 0); q.src = "EMSC";
                q.place = titleCase(p.optString("flynn_region"));
                q.url = "https://www.emsc-csem.org/Earthquake_information/earthquake.php?id=" + p.optString("source_id");
                try { q.time = t.parse(p.optString("time").substring(0, 19)).getTime(); } catch (Exception e) { continue; }
                boolean dup = false;
                for (Q o : out) if (Math.abs(o.time - q.time) < 90000 && distKm(o.lat, o.lon, q.lat, q.lon) < 150) { dup = true; break; }
                if (!dup) out.add(q);
            }
        } catch (Exception ignored) { }
        return out;
    }

    static String titleCase(String s) {
        StringBuilder b = new StringBuilder();
        boolean up = true;
        for (char ch : s.toLowerCase(Locale.ROOT).toCharArray()) {
            b.append(up ? Character.toUpperCase(ch) : ch);
            up = ch == ' ' || ch == ',' || ch == '-' || ch == '(';
        }
        return b.toString();
    }

    // ---------- revisión principal ----------
    public static synchronized void check(Context ctx) {
        Context c = ctx.getApplicationContext();
        ensureChannels(c);
        try { KitReminders.check(c); } catch (Exception ignored) { }
        JSONObject s = settings(c);
        SharedPreferences p = prefs(c);
        boolean loc = hasLocation(s);
        double minMag = s.optDouble("minMag", 4.5), radius = s.optDouble("radius", 300);
        List<double[]> places = placeCoords(s);
        Set<String> seen = new HashSet<>(p.getStringSet("seen", new HashSet<>()));
        boolean firstRun = !p.getBoolean("primed", false);

        List<Q> qs = fetchQuakes(Math.max(2.0, Math.min(minMag, 4.5) - 0.5));
        long now = System.currentTimeMillis();
        Q nearest = null;
        double nearestD = 0;
        for (Q q : qs) {
            if (now - q.time > MAX_AGE_MS) continue;
            double d = Double.MAX_VALUE;
            int which = 0;
            for (int i = 0; i < places.size(); i++) {
                double di = distKm(places.get(i)[0], places.get(i)[1], q.lat, q.lon);
                if (di < d) { d = di; which = i; }
            }
            if (loc && d <= radius && (nearest == null || q.time > nearest.time)) { nearest = q; nearestD = d; }
            if (seen.contains(q.id)) continue;
            seen.add(q.id);
            if (firstRun) continue;                               // la primera vez solo se registra lo que ya había
            String where = loc ? placeName(s, which) : "";
            if (loc && q.mag >= minMag && d <= radius) {
                notifyQuake(c, q, d, true, where);
                if (s.optBoolean("voice", true)) Speaker.say(c, String.format(Locale.US,
                        "Atención. Sismo de magnitud %s a %d kilómetros de %s.", String.format(Locale.US, "%.1f", q.mag).replace(".", " punto "), Math.round(d), where));
            } else if (s.optBoolean("world", true) && q.mag >= 7) {
                notifyQuake(c, q, d, false, where);
            }
        }
        if (seen.size() > 600) {                                  // evitar que crezca sin límite
            List<String> l = new ArrayList<>(seen);
            seen = new HashSet<>(l.subList(l.size() - 400, l.size()));
        }
        p.edit().putStringSet("seen", seen).putBoolean("primed", true).apply();
        if (loc) QuakeWidget.update(c, nearest, nearestD, placeName(s, 0));

        if (s.optBoolean("tsunami", true) && now - p.getLong("tsunamiAt", 0) > TSUNAMI_EVERY_MS) {
            p.edit().putLong("tsunamiAt", now).apply();
            checkTsunami(c, s);
        }
        if (loc && s.optBoolean("rain", true) && now - p.getLong("weatherAt", 0) > WEATHER_EVERY_MS) {
            p.edit().putLong("weatherAt", now).apply();
            checkWeather(c, s);
        }
    }

    // ---------- lluvias fuertes (MET Norway: gratis y con uso comercial permitido, cada 3 horas) ----------
    private static final long WEATHER_EVERY_MS = 3L * 60 * 60 * 1000;

    static void checkWeather(Context c, JSONObject s) {
        SharedPreferences p = prefs(c);
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new java.util.Date());
        Set<String> sent = new HashSet<>(p.getStringSet("wxSent", new HashSet<>()));
        List<double[]> places = placeCoords(s);
        for (int i = 0; i < places.size(); i++) {
            double lat = places.get(i)[0], lon = places.get(i)[1];
            String where = placeName(s, i);
            try {
                JSONObject f = new JSONObject(get(String.format(Locale.US,
                        "https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=%.3f&lon=%.3f", lat, lon)));
                JSONArray ts = f.getJSONObject("properties").getJSONArray("timeseries");
                // Próximas 24 horas, hora a hora
                double day = 0, maxH = 0;
                for (int k = 0; k < Math.min(24, ts.length()); k++) {
                    JSONObject n1 = ts.getJSONObject(k).getJSONObject("data").optJSONObject("next_1_hours");
                    if (n1 == null || n1.optJSONObject("details") == null) continue;
                    double mm = n1.getJSONObject("details").optDouble("precipitation_amount", 0);
                    day += mm;
                    maxH = Math.max(maxH, mm);
                }
                String key = "rain:" + i + ":" + today;
                if ((day >= 50 || maxH >= 20) && !sent.contains(key)) {
                    sent.add(key);
                    notifyInfo(c, "🌧️ Lluvia muy fuerte en " + where,
                            String.format(Locale.forLanguageTag("es"), "Se esperan %.0f mm en las próximas 24 horas (aguaceros de hasta %.0f mm por hora). Aléjate de ríos, quebradas y laderas.", day, maxH), key);
                }
            } catch (Exception ignored) { }
        }
        if (sent.size() > 200) sent.clear();
        p.edit().putStringSet("wxSent", sent).apply();
    }

    static void notifyInfo(Context c, String title, String body, String key) {
        Notification n = new Notification.Builder(c, CH_INFO)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setContentIntent(openApp(c, null, Math.abs(key.hashCode()) % 10000))
                .setAutoCancel(true)
                .build();
        c.getSystemService(NotificationManager.class).notify(key.hashCode(), n);
    }

    // ---------- tsunami (NOAA: centro del Pacífico y centro nacional de EE. UU.) ----------
    static void checkTsunami(Context c, JSONObject s) {
        SharedPreferences p = prefs(c);
        Set<String> seen = new HashSet<>(p.getStringSet("tsuSeen", new HashSet<>()));
        boolean first = !p.getBoolean("tsuPrimed", false);
        String[][] feeds = {{"https://www.tsunami.gov/events/xml/PHEBAtom.xml", "Centro de Alerta de Tsunamis del Pacífico"},
                {"https://www.tsunami.gov/events/xml/PAAQAtom.xml", "Centro Nacional de Alerta de Tsunamis (EE. UU.)"}};
        for (String[] f : feeds) {
            try {
                Document doc = DocumentBuilderFactory.newInstance().newDocumentBuilder()
                        .parse(new ByteArrayInputStream(get(f[0]).getBytes(StandardCharsets.UTF_8)));
                NodeList entries = doc.getElementsByTagName("entry");
                for (int i = 0; i < entries.getLength(); i++) {
                    Element e = (Element) entries.item(i);
                    String id = text(e, "id"), title = text(e, "title").replaceAll("\\s+", " ").trim();
                    if (id.isEmpty() || seen.contains(id)) continue;
                    seen.add(id);
                    if (first) continue;
                    String low = title.toLowerCase(Locale.ROOT);
                    boolean serious = low.contains("warning") || low.contains("advisory") || low.contains("watch") || low.contains("threat");
                    if (!serious) continue;
                    double d = -1;
                    String pt = text(e, "georss:point");
                    if (!pt.isEmpty() && hasLocation(s)) {
                        String[] ll = pt.trim().split("\\s+");
                        d = distKm(s.optDouble("lat"), s.optDouble("lon"), Double.parseDouble(ll[0]), Double.parseDouble(ll[1]));
                    }
                    if (d < 0 || d <= 3000) notifyTsunami(c, title, f[1], d);
                }
            } catch (Exception ignored) { }
        }
        p.edit().putStringSet("tsuSeen", seen).putBoolean("tsuPrimed", true).apply();
    }

    private static String text(Element e, String tag) {
        NodeList l = e.getElementsByTagName(tag);
        return l.getLength() > 0 ? l.item(0).getTextContent() : "";
    }

    // ---------- notificaciones ----------
    private static PendingIntent openApp(Context c, Q q, int code) {
        Intent i = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (q != null) i.putExtra("quake", q.json().toString());
        return PendingIntent.getActivity(c, code, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static void notifyQuake(Context c, Q q, double distKm, boolean nearAlarm) { notifyQuake(c, q, distKm, nearAlarm, ""); }

    static void notifyQuake(Context c, Q q, double distKm, boolean nearAlarm, String where) {
        String mag = String.format(Locale.US, "%.1f", q.mag);
        String title = nearAlarm ? "🚨 Sismo de magnitud " + mag + (where.isEmpty() ? " cerca de ti" : " cerca de " + where) : "🌎 Sismo muy fuerte: magnitud " + mag;
        String body = q.place + (distKm < 1e6 ? " · a " + Math.round(distKm) + " km" + (where.isEmpty() ? "" : " de " + where) : "") + (q.tsunami ? " · posible tsunami: revisa boletines" : "")
                + "\nSi lo sentiste fuerte: agáchate, cúbrete y sujétate. Después, revisa a tu familia.";
        Notification n = new Notification.Builder(c, nearAlarm ? CH_ALARM : CH_INFO)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setContentIntent(openApp(c, q, (int) (q.time % 100000)))
                .setAutoCancel(true)
                .setCategory(nearAlarm ? Notification.CATEGORY_ALARM : Notification.CATEGORY_EVENT)
                .setColor(Color.rgb(255, 59, 78))
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .build();
        if (nearAlarm) n.flags |= Notification.FLAG_INSISTENT;   // la alarma suena hasta que la toques
        c.getSystemService(NotificationManager.class).notify(q.id.hashCode(), n);
    }

    static void notifyTsunami(Context c, String title, String center, double distKm) {
        String body = title + "\n" + center + (distKm >= 0 ? " · epicentro a " + Math.round(distKm) + " km de ti" : "")
                + "\nSi estás en la costa: aléjate del mar y sube a un lugar alto. Sigue a las autoridades locales.";
        Notification n = new Notification.Builder(c, CH_ALARM)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle("🌊 Boletín de tsunami")
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setContentIntent(openApp(c, null, 77))
                .setAutoCancel(true)
                .setCategory(Notification.CATEGORY_ALARM)
                .setColor(Color.rgb(30, 107, 255))
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .build();
        n.flags |= Notification.FLAG_INSISTENT;
        c.getSystemService(NotificationManager.class).notify(title.hashCode(), n);
    }

    /** Alarma de prueba (desde ajustes). */
    static void test(Context c) {
        ensureChannels(c);
        Q q = new Q();
        q.id = "prueba"; q.mag = 5.0; q.place = "PRUEBA · así sonará la alarma"; q.src = "Orbe Sismos"; q.url = "";
        q.time = System.currentTimeMillis(); q.lat = 0; q.lon = 0;
        notifyQuake(c, q, 1e7, true);
        if (settings(c).optBoolean("voice", true)) Speaker.say(c, "Prueba de alarma de Orbe Sismos. Así te avisaremos si hay un sismo fuerte cerca.");
    }

}
