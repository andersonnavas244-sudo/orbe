package com.orberadio.app;

import android.app.PendingIntent;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.annotation.OptIn;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.session.LibraryResult;
import androidx.media3.session.MediaLibraryService;
import androidx.media3.session.MediaSession;

import com.google.common.collect.ImmutableList;
import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.ListenableFuture;
import com.google.common.util.concurrent.SettableFuture;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.Scanner;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Reproductor de radio (ExoPlayer) en segundo plano.
 * - Lee el título de la canción que envían las emisoras (metadatos ICY / HLS).
 * - Expone una biblioteca para Android Auto (Favoritos, Recientes, Top mundial).
 * - Temporizador para dormir, arranque desde widget y alarma.
 */
@OptIn(markerClass = UnstableApi.class)
public class PlaybackService extends MediaLibraryService {

    public static final String ACTION_TOGGLE = "com.orberadio.app.TOGGLE";
    public static final String ACTION_ALARM = "com.orberadio.app.ALARM";
    public static final String ACTION_SLEEP = "com.orberadio.app.SLEEP";
    public static final String EXTRA_MINUTES = "minutes";

    /** Avisa a la interfaz cuántos minutos faltan para apagarse (0 = sin temporizador). */
    public interface SleepListener { void onSleep(int minutesLeft); }
    static volatile SleepListener sleepListener;
    static volatile long sleepEndsAt = 0;

    private ExoPlayer player;
    private MediaLibrarySession session;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final List<JSONObject> topCache = new ArrayList<>();

    @Override
    public void onCreate() {
        super.onCreate();
        DefaultHttpDataSource.Factory http = new DefaultHttpDataSource.Factory()
                .setUserAgent("OrbeRadio/2.0 (Android)")
                .setAllowCrossProtocolRedirects(true)
                .setConnectTimeoutMs(15000)
                .setReadTimeoutMs(20000);
        player = new ExoPlayer.Builder(this)
                .setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(C.USAGE_MEDIA)
                        .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(), true) // gestiona el foco de audio
                .setHandleAudioBecomingNoisy(true)                                // pausa al quitar audífonos
                .setWakeMode(C.WAKE_MODE_NETWORK)
                .setMediaSourceFactory(new DefaultMediaSourceFactory(new DefaultDataSource.Factory(this, http)))
                .build();

        player.addListener(new Player.Listener() {
            @Override public void onIsPlayingChanged(boolean isPlaying) { refreshWidget(); }
            @Override public void onMediaMetadataChanged(@NonNull MediaMetadata m) { refreshWidget(); }
            @Override public void onPlayerError(@NonNull PlaybackException error) { refreshWidget(); }
        });

        PendingIntent open = PendingIntent.getActivity(this, 0,
                new Intent(this, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        session = new MediaLibrarySession.Builder(this, player, new LibraryCallback())
                .setSessionActivity(open)
                .build();
        // Se registra ya, para poder pasar a primer plano aunque se arranque desde el widget o la alarma.
        addSession(session);
    }

    @Nullable
    @Override
    public MediaLibrarySession onGetSession(@NonNull MediaSession.ControllerInfo controllerInfo) {
        return session;
    }

    @Override
    public int onStartCommand(@Nullable Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_TOGGLE.equals(action)) {
            if (player.isPlaying()) player.pause();
            else playLastOrResume();
        } else if (ACTION_ALARM.equals(action)) {
            JSONObject st = StationStore.alarmStation(this);
            if (st == null) st = StationStore.getLast(this);
            if (st != null) {
                StationStore.setLast(this, st);
                playStation(st);
                fadeIn();
            }
        } else if (ACTION_SLEEP.equals(action)) {
            setSleep(intent.getIntExtra(EXTRA_MINUTES, 0));
        }
        return super.onStartCommand(intent, flags, startId);
    }

    private void playLastOrResume() {
        if (player.getMediaItemCount() > 0) {
            // En vivo: al reanudar se vuelve a conectar al directo.
            if (player.getPlaybackState() == Player.STATE_IDLE || player.getPlaybackState() == Player.STATE_ENDED) player.prepare();
            else player.seekToDefaultPosition();
            player.play();
            return;
        }
        JSONObject last = StationStore.getLast(this);
        if (last != null) playStation(last);
    }

    private void playStation(JSONObject st) {
        player.setMediaItem(StationStore.toMediaItem(st));
        player.prepare();
        player.play();
    }

    /** La alarma empieza suave y sube el volumen en 30 segundos. */
    private void fadeIn() {
        player.setVolume(0.05f);
        final long start = System.currentTimeMillis();
        handler.post(new Runnable() {
            @Override public void run() {
                float p = Math.min(1f, (System.currentTimeMillis() - start) / 30000f);
                player.setVolume(0.05f + 0.95f * p);
                if (p < 1f) handler.postDelayed(this, 500);
            }
        });
    }

    // ---------- temporizador para dormir ----------
    private final Runnable sleepTick = new Runnable() {
        @Override public void run() {
            long left = sleepEndsAt - System.currentTimeMillis();
            if (left <= 0) {
                fadeOutAndPause();
                return;
            }
            notifySleep((int) Math.ceil(left / 60000.0));
            handler.postDelayed(this, Math.min(left, 30000));
        }
    };

    private void setSleep(int minutes) {
        handler.removeCallbacks(sleepTick);
        if (minutes <= 0) { sleepEndsAt = 0; notifySleep(0); return; }
        sleepEndsAt = System.currentTimeMillis() + minutes * 60000L;
        handler.post(sleepTick);
    }

    private void fadeOutAndPause() {
        final float startVol = player.getVolume();
        final long start = System.currentTimeMillis();
        handler.post(new Runnable() {
            @Override public void run() {
                float p = Math.min(1f, (System.currentTimeMillis() - start) / 10000f);
                player.setVolume(startVol * (1f - p));
                if (p < 1f) { handler.postDelayed(this, 250); return; }
                player.pause();
                player.setVolume(1f);
                sleepEndsAt = 0;
                notifySleep(0);
            }
        });
    }

    private void notifySleep(int min) {
        SleepListener l = sleepListener;
        if (l != null) l.onSleep(min);
    }

    private void refreshWidget() {
        MediaMetadata m = player.getMediaMetadata();
        String station = m.station != null ? m.station.toString() : (m.title != null ? m.title.toString() : null);
        String song = m.title != null && station != null && !station.contentEquals(m.title) ? m.title.toString() : null;
        RadioWidget.update(this, player.isPlaying() || (player.getPlayWhenReady() && player.getPlaybackState() == Player.STATE_BUFFERING), station, song);
    }

    @Override
    public void onTaskRemoved(@Nullable Intent rootIntent) {
        // Si no está sonando nada al cerrar la app, se libera todo.
        if (!player.getPlayWhenReady() || player.getMediaItemCount() == 0) stopSelf();
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        sleepEndsAt = 0;
        RadioWidget.update(this, false, null, null);
        session.release();
        player.release();
        io.shutdown();
        super.onDestroy();
    }

    // ---------- biblioteca para Android Auto ----------
    private static MediaItem folder(String id, String title) {
        return new MediaItem.Builder().setMediaId(id).setMediaMetadata(new MediaMetadata.Builder()
                .setTitle(title).setIsBrowsable(true).setIsPlayable(false)
                .setMediaType(MediaMetadata.MEDIA_TYPE_FOLDER_RADIO_STATIONS).build()).build();
    }

    private List<MediaItem> toItems(List<JSONObject> list) {
        List<MediaItem> out = new ArrayList<>();
        for (JSONObject o : list) out.add(StationStore.toMediaItem(o));
        return out;
    }

    /** Emisoras más votadas del mundo (se piden a Radio Browser y se guardan en memoria). */
    private List<JSONObject> fetchTop() {
        synchronized (topCache) { if (!topCache.isEmpty()) return new ArrayList<>(topCache); }
        List<JSONObject> out = new ArrayList<>();
        String[] mirrors = {"de1", "de2", "fi1"};
        for (String m : mirrors) {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL("https://" + m
                        + ".api.radio-browser.info/json/stations/topvote?limit=60&hidebroken=true").openConnection();
                c.setConnectTimeout(8000);
                c.setReadTimeout(10000);
                c.setRequestProperty("User-Agent", "OrbeRadio/2.0 (Android)");
                try (InputStream in = c.getInputStream(); Scanner s = new Scanner(in, "UTF-8").useDelimiter("\\A")) {
                    JSONArray arr = new JSONArray(s.hasNext() ? s.next() : "[]");
                    for (int i = 0; i < arr.length(); i++) {
                        JSONObject r = arr.getJSONObject(i);
                        String url = r.optString("url_resolved", r.optString("url"));
                        if (url.isEmpty()) continue;
                        JSONObject st = new JSONObject();
                        st.put("id", r.optString("stationuuid"));
                        st.put("name", r.optString("name").trim());
                        st.put("url", url);
                        st.put("sub", r.optString("country"));
                        st.put("img", r.optString("favicon"));
                        st.put("cc", r.optString("countrycode"));
                        out.add(st);
                    }
                }
                break;
            } catch (Exception ignored) { /* siguiente espejo */ }
        }
        synchronized (topCache) { topCache.clear(); topCache.addAll(out); }
        return out;
    }

    private class LibraryCallback implements MediaLibrarySession.Callback {
        @NonNull
        @Override
        public ListenableFuture<LibraryResult<MediaItem>> onGetLibraryRoot(
                @NonNull MediaLibrarySession s, @NonNull MediaSession.ControllerInfo b, @Nullable LibraryParams params) {
            return Futures.immediateFuture(LibraryResult.ofItem(folder("root", "Orbe Radio"), params));
        }

        @NonNull
        @Override
        public ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> onGetChildren(
                @NonNull MediaLibrarySession s, @NonNull MediaSession.ControllerInfo b, @NonNull String parentId,
                int page, int pageSize, @Nullable LibraryParams params) {
            switch (parentId) {
                case "root":
                    return Futures.immediateFuture(LibraryResult.ofItemList(ImmutableList.of(
                            folder("favs", "Favoritos"), folder("recents", "Recientes"), folder("top", "Top mundial")), params));
                case "favs":
                    return Futures.immediateFuture(LibraryResult.ofItemList(toItems(StationStore.favorites(PlaybackService.this)), params));
                case "recents":
                    return Futures.immediateFuture(LibraryResult.ofItemList(toItems(StationStore.recents(PlaybackService.this)), params));
                case "top": {
                    SettableFuture<LibraryResult<ImmutableList<MediaItem>>> f = SettableFuture.create();
                    io.execute(() -> f.set(LibraryResult.ofItemList(toItems(fetchTop()), params)));
                    return f;
                }
                default:
                    return Futures.immediateFuture(LibraryResult.ofItemList(ImmutableList.of(), params));
            }
        }

        @NonNull
        @Override
        public ListenableFuture<LibraryResult<MediaItem>> onGetItem(
                @NonNull MediaLibrarySession s, @NonNull MediaSession.ControllerInfo b, @NonNull String mediaId) {
            JSONObject st;
            synchronized (topCache) { st = StationStore.find(PlaybackService.this, mediaId, topCache); }
            if (st == null) return Futures.immediateFuture(LibraryResult.ofError(LibraryResult.RESULT_ERROR_BAD_VALUE));
            return Futures.immediateFuture(LibraryResult.ofItem(StationStore.toMediaItem(st), null));
        }

        /** Completa la URL de las emisoras elegidas desde Android Auto o desde la app. */
        @NonNull
        @Override
        public ListenableFuture<List<MediaItem>> onAddMediaItems(
                @NonNull MediaSession s, @NonNull MediaSession.ControllerInfo c, @NonNull List<MediaItem> items) {
            List<MediaItem> out = new ArrayList<>();
            for (MediaItem it : items) {
                JSONObject st = null;
                Bundle ex = it.mediaMetadata.extras;
                if (ex != null) st = StationStore.parse(ex.getString("json"));
                if (st == null) synchronized (topCache) { st = StationStore.find(PlaybackService.this, it.mediaId, topCache); }
                if (st != null) {
                    StationStore.setLast(PlaybackService.this, st);
                    out.add(StationStore.toMediaItem(st));
                } else if (it.localConfiguration != null) {
                    out.add(it);
                } else if (it.requestMetadata.mediaUri != null) {
                    out.add(it.buildUpon().setUri(it.requestMetadata.mediaUri).build());
                }
            }
            return Futures.immediateFuture(out);
        }

        /** "Reanudar" desde el sistema (Android 13+): vuelve a la última emisora. */
        @NonNull
        @Override
        public ListenableFuture<MediaSession.MediaItemsWithStartPosition> onPlaybackResumption(
                @NonNull MediaSession s, @NonNull MediaSession.ControllerInfo c) {
            JSONObject last = StationStore.getLast(PlaybackService.this);
            List<MediaItem> list = new ArrayList<>();
            if (last != null) list.add(StationStore.toMediaItem(last));
            return Futures.immediateFuture(new MediaSession.MediaItemsWithStartPosition(list, 0, C.TIME_UNSET));
        }
    }
}
