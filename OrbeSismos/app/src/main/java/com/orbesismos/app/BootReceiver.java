package com.orbesismos.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Al reiniciar el teléfono, vuelve a encender la vigilancia de sismos. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        AlertWorker.schedule(c);
        if (AlertEngine.hasLocation(AlertEngine.settings(c))) WatchService.sync(c);
    }
}
