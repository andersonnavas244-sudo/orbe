package com.orbeclima.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Al reiniciar el teléfono (o actualizar la app) vuelve a programar la revisión de alertas. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        AlertWorker.schedule(c);
    }
}
