package com.orberadio.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

import org.json.JSONObject;

/** Widget de la pantalla de inicio: última emisora, canción y botón de reproducir/pausar. */
public class RadioWidget extends AppWidgetProvider {

    private static boolean playing;
    private static String station, song;

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        render(context, mgr, ids);
    }

    /** Lo llama el reproductor cada vez que cambia el estado o la canción. */
    public static void update(Context c, boolean isPlaying, String stationName, String songTitle) {
        playing = isPlaying;
        if (stationName != null) station = stationName;
        song = songTitle;
        AppWidgetManager mgr = AppWidgetManager.getInstance(c);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(c, RadioWidget.class));
        if (ids.length > 0) render(c, mgr, ids);
    }

    private static void render(Context c, AppWidgetManager mgr, int[] ids) {
        JSONObject last = StationStore.getLast(c);
        String name = station != null ? station : last != null ? last.optString("name") : null;
        String sub = song != null && !song.isEmpty() ? "♪ " + song
                : last != null ? last.optString("sub") : "Toca para abrir el globo";

        int flags = PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT;
        PendingIntent open = PendingIntent.getActivity(c, 10,
                new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP), flags);

        PendingIntent toggle;
        Intent t = new Intent(c, PlaybackService.class).setAction(PlaybackService.ACTION_TOGGLE);
        if (last == null) toggle = open;                              // aún no hay emisora: abre la app
        else if (playing) toggle = PendingIntent.getService(c, 11, t, flags);   // pausar
        else toggle = PendingIntent.getForegroundService(c, 12, t, flags);      // reproducir

        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_radio);
        v.setTextViewText(R.id.w_title, name != null && !name.isEmpty() ? name : "Orbe Radio");
        v.setTextViewText(R.id.w_sub, sub);
        v.setImageViewResource(R.id.w_play, playing ? R.drawable.ic_pause : R.drawable.ic_play);
        v.setContentDescription(R.id.w_play, playing ? "Pausar" : "Reproducir");
        v.setOnClickPendingIntent(R.id.w_root, open);
        v.setOnClickPendingIntent(R.id.w_play, toggle);
        for (int id : ids) mgr.updateAppWidget(id, v);
    }
}
