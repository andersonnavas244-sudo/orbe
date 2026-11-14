package com.orberadio.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Al reiniciar el teléfono, vuelve a programar la alarma con radio. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) AlarmReceiver.schedule(c);
    }
}
