package com.orbebiblia.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Al reiniciar el teléfono (o actualizar la app) vuelve a programar el versículo del día. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        DailyVerse.schedule(c);
        PrayerReminder.scheduleAll(c);
    }
}
