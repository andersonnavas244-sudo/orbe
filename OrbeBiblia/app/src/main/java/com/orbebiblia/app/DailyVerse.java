package com.orbebiblia.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.Calendar;

/**
 * Versículo del día: una notificación diaria a la hora que elige la persona (por defecto 7:00 a. m.).
 * El texto sale de assets/www/data/diario.json (el mismo versículo que muestra la app ese día), sin internet.
 */
public class DailyVerse extends BroadcastReceiver {

    static final String CHANNEL = "versiculo_diario";
    private static final int REQ = 7001;

    static SharedPreferences prefs(Context c) { return StationStore.prefs(c); }

    public static boolean enabled(Context c) { return prefs(c).getBoolean("diario_on", true); }
    public static int hour(Context c) { return prefs(c).getInt("diario_h", 7); }
    public static int minute(Context c) { return prefs(c).getInt("diario_m", 0); }

    public static void set(Context c, boolean on, int h, int m) {
        prefs(c).edit().putBoolean("diario_on", on).putInt("diario_h", h).putInt("diario_m", m).apply();
        schedule(c);
    }

    static void ensureChannel(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Versículo del día", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("Un versículo de la Biblia cada día, a la hora que elijas");
            nm.createNotificationChannel(ch);
        }
    }

    private static PendingIntent pending(Context c) {
        Intent i = new Intent(c, DailyVerse.class).setAction("com.orbebiblia.app.VERSICULO");
        return PendingIntent.getBroadcast(c, REQ, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Programa el próximo aviso (o lo cancela si está apagado). */
    public static void schedule(Context c) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        PendingIntent pi = pending(c);
        am.cancel(pi);
        if (!enabled(c)) return;
        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.HOUR_OF_DAY, hour(c));
        cal.set(Calendar.MINUTE, minute(c));
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        if (cal.getTimeInMillis() <= System.currentTimeMillis() + 30_000) cal.add(Calendar.DAY_OF_YEAR, 1);
        // Sin alarma exacta: Android puede moverla unos minutos para ahorrar batería (no hace falta más precisión)
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cal.getTimeInMillis(), pi);
    }

    /** [referencia, texto, tema] del versículo de hoy. */
    static String[] today(Context c) {
        try (InputStream in = c.getAssets().open("www/data/diario.json")) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[16384];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            JSONArray all = new JSONArray(out.toString("UTF-8"));
            int day = Calendar.getInstance().get(Calendar.DAY_OF_YEAR) - 1;
            JSONArray v = all.getJSONArray(day % all.length());
            return new String[]{v.getString(0), v.getString(1), v.optString(2)};
        } catch (Exception e) {
            return new String[]{"Salmos 118:24", "Este es el día que hizo Jehová: Nos gozaremos y alegraremos en él.", ""};
        }
    }

    @Override
    public void onReceive(Context c, Intent intent) {
        if (enabled(c)) show(c);
        try { VersiculoWidget.updateAll(c); } catch (Exception ignored) { }
        schedule(c);
    }

    static void show(Context c) {
        ensureChannel(c);
        String[] v = today(c);
        Intent open = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP)
                .putExtra("open", "hoy");
        PendingIntent pi = PendingIntent.getActivity(c, REQ, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String body = "«" + v[1] + "» " + v[0];
        Notification n = new Notification.Builder(c, CHANNEL)
                .setSmallIcon(R.drawable.ic_notification)
                .setColor(0xFFF5C26B)
                .setContentTitle("✨ Versículo del día")
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setContentIntent(pi)
                .build();
        c.getSystemService(NotificationManager.class).notify(REQ, n);
    }
}
