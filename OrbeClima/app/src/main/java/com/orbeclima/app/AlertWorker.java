package com.orbeclima.app;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import java.util.concurrent.TimeUnit;

/** Revisa cada hora el pronóstico y los ciclones de tus lugares, aunque la app esté cerrada. */
public class AlertWorker extends Worker {

    public AlertWorker(@NonNull Context c, @NonNull WorkerParameters p) { super(c, p); }

    @NonNull
    @Override
    public Result doWork() {
        WeatherAlerts.check(getApplicationContext());
        return Result.success();
    }

    public static void schedule(Context c) {
        PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(AlertWorker.class, 60, TimeUnit.MINUTES)
                .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build();
        WorkManager.getInstance(c).enqueueUniquePeriodicWork("alertas-clima", ExistingPeriodicWorkPolicy.KEEP, req);
    }
}
