package com.orbebiblia.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.Calendar;

/**
 * Oración de la mañana y de la noche: un aviso a la hora que elige la persona, con una oración corta
 * (assets/www/data/oraciones-dia.json, sin internet). Apagados hasta que la persona los active.
 */
public class PrayerReminder extends BroadcastReceiver {

    static final String CHANNEL = "oracion_diaria";
    static final String[] KINDS = {"manana", "noche"};

    private static int defH(String k) { return "manana".equals(k) ? 6 : 21; }
    private static int req(String k) { return "manana".equals(k) ? 7101 : 7102; }

    public static boolean enabled(Context c, String k) { return StationStore.prefs(c).getBoolean("ora_" + k + "_on", false); }
    public static int hour(Context c, String k) { return StationStore.prefs(c).getInt("ora_" + k + "_h", defH(k)); }
    public static int minute(Context c, String k) { return StationStore.prefs(c).getInt("ora_" + k + "_m", "manana".equals(k) ? 30 : 0); }

    public static void set(Context c, String k, boolean on, int h, int m) {
        StationStore.prefs(c).edit().putBoolean("ora_" + k + "_on", on).putInt("ora_" + k + "_h", h).putInt("ora_" + k + "_m", m).apply();
        schedule(c, k);
    }

    public static void scheduleAll(Context c) { for (String k : KINDS) schedule(c, k); }

    private static PendingIntent pending(Context c, String k) {
        Intent i = new Intent(c, PrayerReminder.class).setAction("com.orbebiblia.app.ORACION").putExtra("kind", k);
        return PendingIntent.getBroadcast(c, req(k), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    public static void schedule(Context c, String k) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        PendingIntent pi = pending(c, k);
        am.cancel(pi);
        if (!enabled(c, k)) return;
        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.HOUR_OF_DAY, hour(c, k));
        cal.set(Calendar.MINUTE, minute(c, k));
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        if (cal.getTimeInMillis() <= System.currentTimeMillis() + 30_000) cal.add(Calendar.DAY_OF_YEAR, 1);
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cal.getTimeInMillis(), pi);
    }

    @Override
    public void onReceive(Context c, Intent intent) {
        String k = intent.getStringExtra("kind");
        if (k == null) return;
        if (enabled(c, k)) show(c, k);
        schedule(c, k);
    }

    static void show(Context c, String k) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Oración de la mañana y de la noche", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("Un recordatorio para orar, con una oración corta");
            nm.createNotificationChannel(ch);
        }
        String title = "manana".equals(k) ? "🌅 Oración de la mañana" : "🌙 Oración de la noche";
        String text = "manana".equals(k) ? "Empieza el día con Dios." : "Termina el día en paz con Dios.";
        try (InputStream in = c.getAssets().open("www/data/oraciones-dia.json")) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            JSONArray list = new JSONObject(out.toString("UTF-8")).getJSONArray(k);
            int day = Calendar.getInstance().get(Calendar.DAY_OF_YEAR);
            JSONArray o = list.getJSONArray(day % list.length());
            title = ("manana".equals(k) ? "🌅 " : "🌙 ") + o.getString(0);
            text = o.getString(1);
        } catch (Exception ignored) { }
        Intent open = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP)
                .putExtra("open", "oracion-" + k);
        PendingIntent pi = PendingIntent.getActivity(c, req(k), open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification notif = new Notification.Builder(c, CHANNEL)
                .setSmallIcon(R.drawable.ic_notification)
                .setColor(0xFFF5C26B)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setAutoCancel(true)
                .setContentIntent(pi)
                .build();
        nm.notify(req(k), notif);
    }
}
