package com.orbesismos.app;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import java.util.Locale;

/**
 * Para que las alarmas lleguen siempre: Android y algunas marcas (Xiaomi, Huawei, Oppo, Vivo, Samsung…)
 * cierran las apps en segundo plano para ahorrar batería. Aquí se consulta si Orbe Sismos está libre
 * de esa optimización y se abren los ajustes correctos para que la persona lo permita.
 * (No se pide el permiso REQUEST_IGNORE_BATTERY_OPTIMIZATIONS: se abre la pantalla del sistema.)
 */
public final class BatteryHelper {
    private BatteryHelper() { }

    /** true si Android no limita a Orbe Sismos en segundo plano. */
    public static boolean isFree(Activity a) {
        PowerManager pm = a.getSystemService(PowerManager.class);
        return pm != null && pm.isIgnoringBatteryOptimizations(a.getPackageName());
    }

    /** Fabricante en minúsculas (xiaomi, huawei, samsung…), para dar instrucciones a la medida. */
    public static String brand() {
        return Build.MANUFACTURER == null ? "" : Build.MANUFACTURER.toLowerCase(Locale.ROOT);
    }

    /** Lista de "Optimización de batería" del sistema; si no existe, la ficha de la app. */
    public static void openOptimization(Activity a) {
        if (tryStart(a, new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))) return;
        openAppDetails(a);
    }

    /** Pantallas de "inicio automático" / "apps protegidas" de cada marca; si no hay, la ficha de la app. */
    public static void openAutostart(Activity a) {
        String[][] screens = {
                {"com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"},
                {"com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"},
                {"com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity"},
                {"com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"},
                {"com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"},
                {"com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"},
                {"com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"},
                {"com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"},
                {"com.samsung.android.lool", "com.samsung.android.sm.battery.ui.BatteryActivity"},
                {"com.samsung.android.lool", "com.samsung.android.sm.ui.battery.BatteryActivity"},
                {"com.asus.mobilemanager", "com.asus.mobilemanager.powersaver.PowerSaverSettings"},
                {"com.letv.android.letvsafe", "com.letv.android.letvsafe.AutobootManageActivity"}
        };
        for (String[] s : screens) {
            Intent i = new Intent().setComponent(new ComponentName(s[0], s[1]));
            if (tryStart(a, i)) return;
        }
        openAppDetails(a);
    }

    public static void openAppDetails(Activity a) {
        tryStart(a, new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + a.getPackageName())));
    }

    private static boolean tryStart(Activity a, Intent i) {
        try {
            // Se intenta abrir directamente: desde Android 11 no se pueden "ver" las apps de otras marcas
            // sin declararlas, pero sí abrir sus pantallas; si no existe o no está permitida, se prueba la siguiente.
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            a.startActivity(i);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
