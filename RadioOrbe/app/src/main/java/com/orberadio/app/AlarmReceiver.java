package com.orberadio.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import java.util.Calendar;

/** Alarma con radio: programa el despertador y, al sonar, enciende la emisora elegida. */
public class AlarmReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context c, Intent intent) {
        if (!StationStore.alarmOn(c)) return;
        try {
            c.startForegroundService(new Intent(c, PlaybackService.class).setAction(PlaybackService.ACTION_ALARM));
        } catch (Exception e) {
            // Sin permiso de alarma exacta Android no deja arrancar el audio en segundo plano:
            // se muestra un aviso que abre la app.
            showFallbackNotification(c);
        }
        schedule(c); // la alarma se repite cada día
    }

    /** Programa la próxima alarma según lo guardado. Devuelve false si se programó de forma aproximada. */
    public static boolean schedule(Context c) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        PendingIntent pi = pending(c);
        am.cancel(pi);
        if (!StationStore.alarmOn(c)) return true;

        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.HOUR_OF_DAY, StationStore.alarmHour(c));
        cal.set(Calendar.MINUTE, StationStore.alarmMinute(c));
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        if (cal.getTimeInMillis() <= System.currentTimeMillis() + 1000) cal.add(Calendar.DAY_OF_YEAR, 1);

        boolean exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
        if (exact) {
            PendingIntent show = PendingIntent.getActivity(c, 21, new Intent(c, MainActivity.class),
                    PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            am.setAlarmClock(new AlarmManager.AlarmClockInfo(cal.getTimeInMillis(), show), pi);
        } else {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cal.getTimeInMillis(), pi);
        }
        return exact;
    }

    private static PendingIntent pending(Context c) {
        return PendingIntent.getBroadcast(c, 20, new Intent(c, AlarmReceiver.class),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static void showFallbackNotification(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel("alarm", "Alarma con radio", NotificationManager.IMPORTANCE_HIGH));
        PendingIntent open = PendingIntent.getActivity(c, 22,
                new Intent(c, MainActivity.class).putExtra("alarm", true).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        nm.notify(23, new Notification.Builder(c, "alarm")
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle("⏰ ¡Hora de despertar!")
                .setContentText("Toca para encender tu emisora")
                .setContentIntent(open)
                .setAutoCancel(true)
                .setCategory(Notification.CATEGORY_ALARM)
                .build());
    }
}
