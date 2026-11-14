package com.orbesismos.app;

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

/** Respaldo: revisa sismos y tsunamis cada 15 minutos aunque Android cierre la vigilancia. */
public class AlertWorker extends Worker {

    public AlertWorker(@NonNull Context c, @NonNull WorkerParameters p) { super(c, p); }

    @NonNull
    @Override
    public Result doWork() {
        AlertEngine.check(getApplicationContext());
        return Result.success();
    }

    public static void schedule(Context c) {
        PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(AlertWorker.class, 15, TimeUnit.MINUTES)
                .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build();
        WorkManager.getInstance(c).enqueueUniquePeriodicWork("revisar-sismos", ExistingPeriodicWorkPolicy.KEEP, req);
    }
}
