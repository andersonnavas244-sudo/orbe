package com.orbeespacio.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Avisos programados: "la Estación Espacial pasa sobre tu ciudad en 10 minutos" y
 * "el lanzamiento empieza en 1 hora". La interfaz calcula los pasos (SGP4) y entrega aquí la
 * lista; se programa solo el próximo aviso y, al sonar, se programa el siguiente.
 * Se guardan en el teléfono, así que siguen funcionando con la app cerrada y tras reiniciar.
 */
public class Reminders extends BroadcastReceiver {

    static final String CHANNEL = "pasos";
    private static final String KEY = "reminders";

    /** Reemplaza todos los avisos de un tipo ("pass" o "launch") por la lista nueva. */
    public static void set(Context c, String kind, JSONArray items) {
        JSONArray keep = new JSONArray();
        JSONArray all = load(c);
        for (int i = 0; i < all.length(); i++) {
            JSONObject o = all.optJSONObject(i);
            if (o != null && !kind.equals(o.optString("kind"))) keep.put(o);
        }
        for (int i = 0; i < items.length(); i++) {
            JSONObject o = items.optJSONObject(i);
            if (o == null) continue;
            try { o.put("kind", kind); } catch (Exception ignored) { }
            keep.put(o);
        }
        StationStore.prefs(c).edit().putString(KEY, keep.toString()).apply();
        scheduleNext(c);
    }

    public static JSONArray load(Context c) {
        try { return new JSONArray(StationStore.prefs(c).getString(KEY, "[]")); } catch (Exception e) { return new JSONArray(); }
    }

    /** Programa la alarma del aviso más cercano en el futuro. */
    public static void scheduleNext(Context c) {
        JSONArray all = load(c);
        long now = System.currentTimeMillis();
        JSONObject next = null;
        JSONArray future = new JSONArray();
        for (int i = 0; i < all.length(); i++) {
            JSONObject o = all.optJSONObject(i);
            if (o == null || o.optLong("at") < now - 60_000) continue;
            future.put(o);
            if (next == null || o.optLong("at") < next.optLong("at")) next = o;
        }
        StationStore.prefs(c).edit().putString(KEY, future.toString()).apply();
        AlarmManager am = c.getSystemService(AlarmManager.class);
        PendingIntent pi = PendingIntent.getBroadcast(c, 7, new Intent(c, Reminders.class),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        am.cancel(pi);
        if (next == null) return;
        long at = Math.max(now + 1000, next.optLong("at"));
        if (canExact(c)) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
    }

    public static boolean canExact(Context c) {
        if (Build.VERSION.SDK_INT < 31) return true;
        return c.getSystemService(AlarmManager.class).canScheduleExactAlarms();
    }

    public static void ensureChannel(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm.getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Pasos y lanzamientos", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Avisos cuando la Estación Espacial pasa sobre ti y antes de los lanzamientos");
        ch.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build());
        ch.enableVibration(true);
        nm.createNotificationChannel(ch);
    }

    @Override
    public void onReceive(Context c, Intent intent) {
        ensureChannel(c);
        JSONArray all = load(c);
        long now = System.currentTimeMillis();
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        for (int i = 0; i < all.length(); i++) {
            JSONObject o = all.optJSONObject(i);
            if (o == null) continue;
            long at = o.optLong("at");
            // Suena lo que tocaba en este momento (o hace poco, si el sistema retrasó la alarma)
            if (at <= now + 30_000 && at > now - 20 * 60_000 && !o.optBoolean("done")) {
                notify(c, nm, o);
                try { o.put("done", true); } catch (Exception ignored) { }
            }
        }
        JSONArray left = new JSONArray();
        for (int i = 0; i < all.length(); i++) {
            JSONObject o = all.optJSONObject(i);
            if (o != null && !o.optBoolean("done") && o.optLong("at") > now - 60_000) left.put(o);
        }
        StationStore.prefs(c).edit().putString(KEY, left.toString()).apply();
        scheduleNext(c);
    }

    private static void notify(Context c, NotificationManager nm, JSONObject o) {
        Intent open = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP)
                .putExtra("open", o.optString("open", "pasos"));
        PendingIntent pi = PendingIntent.getActivity(c, (int) (o.optLong("at") / 1000), open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification n = new Notification.Builder(c, CHANNEL)
                .setSmallIcon(R.drawable.ic_notification)
                .setColor(0xFF22D3EE)
                .setContentTitle(o.optString("title"))
                .setContentText(o.optString("text"))
                .setStyle(new Notification.BigTextStyle().bigText(o.optString("text")))
                .setCategory(Notification.CATEGORY_REMINDER)
                .setAutoCancel(true)
                .setContentIntent(pi)
                .build();
        nm.notify((int) (o.optLong("at") / 1000 % 100000), n);
    }
}
