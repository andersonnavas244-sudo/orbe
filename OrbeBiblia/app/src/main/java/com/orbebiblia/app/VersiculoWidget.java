package com.orbebiblia.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

/** Widget de la pantalla de inicio: el versículo del día (el mismo de la app y de la notificación), sin internet. */
public class VersiculoWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) m.updateAppWidget(id, views(c));
    }

    static RemoteViews views(Context c) {
        String[] v = DailyVerse.today(c);
        RemoteViews rv = new RemoteViews(c.getPackageName(), R.layout.widget_versiculo);
        rv.setTextViewText(R.id.w_text, "«" + v[1] + "»");
        rv.setTextViewText(R.id.w_ref, v[0]);
        rv.setTextViewText(R.id.w_tag, v[2] == null || v[2].isEmpty() ? "✨ VERSÍCULO DEL DÍA" : "✨ VERSÍCULO DEL DÍA · " + v[2].toUpperCase());
        Intent open = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra("open", "hoy");
        rv.setOnClickPendingIntent(R.id.w_root, PendingIntent.getActivity(c, 7201, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        return rv;
    }

    /** Actualiza todos los widgets (al abrir la app y con el aviso diario). */
    public static void updateAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, VersiculoWidget.class));
        if (ids.length > 0) m.updateAppWidget(ids, views(c));
    }
}
