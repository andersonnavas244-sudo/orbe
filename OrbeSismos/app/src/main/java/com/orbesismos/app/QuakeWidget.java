package com.orbesismos.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import java.util.Locale;

/** Widget de la pantalla de inicio: último sismo cerca de ti (lo actualiza la vigilancia). */
public class QuakeWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context c, AppWidgetManager mgr, int[] ids) {
        render(c, mgr, ids);
        AlertWorker.schedule(c);
    }

    static void update(Context c, AlertEngine.Q q, double dist, String city) {
        SharedPreferences p = AlertEngine.prefs(c);
        SharedPreferences.Editor e = p.edit().putString("w_city", city);
        if (q != null) {
            e.putString("w_mag", String.format(Locale.US, "%.1f", q.mag)).putString("w_place", q.place)
                    .putLong("w_time", q.time).putInt("w_dist", (int) Math.round(dist));
        }
        e.putLong("w_checked", System.currentTimeMillis()).apply();
        AppWidgetManager mgr = AppWidgetManager.getInstance(c);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(c, QuakeWidget.class));
        if (ids.length > 0) render(c, mgr, ids);
    }

    private static void render(Context c, AppWidgetManager mgr, int[] ids) {
        SharedPreferences p = AlertEngine.prefs(c);
        String city = p.getString("w_city", "");
        long t = p.getLong("w_time", 0);
        boolean recent = t > 0 && System.currentTimeMillis() - t < 24L * 3600 * 1000;
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_quake);
        v.setTextViewText(R.id.w_title, city.isEmpty() ? "Orbe Sismos" : "📍 " + city);
        if (recent) {
            long min = (System.currentTimeMillis() - t) / 60000;
            String ago = min < 60 ? "hace " + min + " min" : "hace " + (min / 60) + " h";
            v.setTextViewText(R.id.w_mag, p.getString("w_mag", "–"));
            v.setTextViewText(R.id.w_place, p.getString("w_place", ""));
            v.setTextViewText(R.id.w_sub, ago + " · a " + p.getInt("w_dist", 0) + " km");
        } else {
            v.setTextViewText(R.id.w_mag, "✓");
            v.setTextViewText(R.id.w_place, "Sin sismos registrados cerca hoy");
            v.setTextViewText(R.id.w_sub, city.isEmpty() ? "Abre la app y elige tu ubicación" : "Vigilando tu zona");
        }
        PendingIntent open = PendingIntent.getActivity(c, 30, new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        v.setOnClickPendingIntent(R.id.w_root, open);
        for (int id : ids) mgr.updateAppWidget(id, v);
    }
}
