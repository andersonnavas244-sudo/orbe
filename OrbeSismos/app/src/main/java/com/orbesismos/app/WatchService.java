package com.orbesismos.app;

import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Vigilancia en tiempo real: revisa los sismos cada minuto (y los tsunamis cada 5 minutos)
 * aunque la app esté cerrada. Muestra una notificación discreta mientras está activa.
 */
public class WatchService extends Service {

    private static final long EVERY_MS = 60_000;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService io = Executors.newSingleThreadExecutor();

    private final Runnable loop = new Runnable() {
        @Override public void run() {
            io.execute(() -> AlertEngine.check(WatchService.this));
            handler.postDelayed(this, EVERY_MS);
        }
    };

    public static void sync(Context c) {
        boolean on = AlertEngine.settings(c).optBoolean("watch", true);
        Intent i = new Intent(c, WatchService.class);
        try {
            if (on) c.startForegroundService(i); else c.stopService(i);
        } catch (Exception ignored) { /* Android no permitió arrancarlo ahora: queda la revisión periódica */ }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        AlertEngine.ensureChannels(this);
        String city = AlertEngine.settings(this).optString("name", "");
        PendingIntent open = PendingIntent.getActivity(this, 1, new Intent(this, MainActivity.class),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification n = new Notification.Builder(this, AlertEngine.CH_WATCH)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle("Vigilando sismos" + (city.isEmpty() ? "" : " cerca de " + city))
                .setContentText("Te avisaremos con una alarma si hay un sismo fuerte cerca o un boletín de tsunami.")
                .setContentIntent(open)
                .setOngoing(true)
                .build();
        if (Build.VERSION.SDK_INT >= 34) startForeground(9, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        else startForeground(9, n);
        handler.removeCallbacks(loop);
        handler.post(loop);
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(loop);
        io.shutdown();
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
