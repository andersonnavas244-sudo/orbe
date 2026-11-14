package com.orbepodcasts.app;

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

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Reproductor de podcasts (ExoPlayer) en segundo plano:
 * - Guarda dónde quedó cada episodio (cada 5 segundos y al pausar) y retoma desde ahí.
 * - Velocidad de reproducción, saltos de 15/30 s y temporizador para dormir.
 * - Controles en la pantalla bloqueada, auriculares Bluetooth y Android Auto.
 */
@OptIn(markerClass = UnstableApi.class)
public class PlaybackService extends MediaLibraryService {

    public static final String ACTION_SLEEP = "com.orbepodcasts.app.SLEEP";
    public static final String EXTRA_MINUTES = "minutes";

    public interface SleepListener { void onSleep(int minutesLeft); }
    static volatile SleepListener sleepListener;
    static volatile long sleepEndsAt = 0;

    private ExoPlayer player;
    private MediaLibrarySession session;
    private final Handler handler = new Handler(Looper.getMainLooper());

    private final Runnable saver = new Runnable() {
        @Override public void run() {
            savePosition();
            handler.postDelayed(this, 5000);
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        DefaultHttpDataSource.Factory http = new DefaultHttpDataSource.Factory()
                .setUserAgent("OrbePodcasts/1.0 (Android)")
                .setAllowCrossProtocolRedirects(true)
                .setConnectTimeoutMs(15000)
                .setReadTimeoutMs(25000);
        player = new ExoPlayer.Builder(this)
                .setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(C.USAGE_MEDIA)
                        .setContentType(C.AUDIO_CONTENT_TYPE_SPEECH).build(), true)   // voz: el sistema baja el volumen con cuidado
                .setHandleAudioBecomingNoisy(true)                                     // pausa al quitar audífonos
                .setWakeMode(C.WAKE_MODE_NETWORK)
                .setSeekBackIncrementMs(15_000)
                .setSeekForwardIncrementMs(30_000)
                .setMediaSourceFactory(new DefaultMediaSourceFactory(new DefaultDataSource.Factory(this, http)))
                .build();
        player.addListener(new Player.Listener() {
            @Override public void onIsPlayingChanged(boolean playing) { if (!playing) savePosition(); }
            @Override public void onPlaybackStateChanged(int state) { if (state == Player.STATE_ENDED) savePosition(); }
        });

        PendingIntent open = PendingIntent.getActivity(this, 0,
                new Intent(this, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        session = new MediaLibrarySession.Builder(this, player, new LibraryCallback())
                .setSessionActivity(open)
                .build();
        addSession(session);
        handler.postDelayed(saver, 5000);
    }

    /** Guarda dónde va el episodio actual. */
    private void savePosition() {
        if (player == null || player.getMediaItemCount() == 0) return;
        MediaItem it = player.getCurrentMediaItem();
        if (it == null) return;
        long dur = player.getDuration();
        long pos = player.getPlaybackState() == Player.STATE_ENDED ? Math.max(dur, 0) : player.getCurrentPosition();
        if (pos > 0) StationStore.savePosition(this, it.mediaId, pos, dur == C.TIME_UNSET ? 0 : dur);
    }

    @Nullable
    @Override
    public MediaLibrarySession onGetSession(@NonNull MediaSession.ControllerInfo controllerInfo) { return session; }

    @Override
    public int onStartCommand(@Nullable Intent intent, int flags, int startId) {
        if (intent != null && ACTION_SLEEP.equals(intent.getAction())) setSleep(intent.getIntExtra(EXTRA_MINUTES, 0));
        return super.onStartCommand(intent, flags, startId);
    }

    // ---------- temporizador para dormir (-1 = al terminar el episodio) ----------
    private final Runnable sleepTick = new Runnable() {
        @Override public void run() {
            if (sleepEndsAt == -1) {
                long left = player.getDuration() - player.getCurrentPosition();
                if (player.getDuration() > 0 && left < 1500) { player.pause(); sleepEndsAt = 0; notifySleep(0); return; }
                notifySleep(-1);
                handler.postDelayed(this, 1000);
                return;
            }
            long left = sleepEndsAt - System.currentTimeMillis();
            if (left <= 0) { fadeOutAndPause(); return; }
            notifySleep((int) Math.ceil(left / 60000.0));
            handler.postDelayed(this, Math.min(left, 30000));
        }
    };

    private void setSleep(int minutes) {
        handler.removeCallbacks(sleepTick);
        if (minutes == 0) { sleepEndsAt = 0; notifySleep(0); return; }
        sleepEndsAt = minutes < 0 ? -1 : System.currentTimeMillis() + minutes * 60000L;
        handler.post(sleepTick);
    }

    private void fadeOutAndPause() {
        final float startVol = player.getVolume();
        final long start = System.currentTimeMillis();
        handler.post(new Runnable() {
            @Override public void run() {
                float p = Math.min(1f, (System.currentTimeMillis() - start) / 8000f);
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

    @Override
    public void onTaskRemoved(@Nullable Intent rootIntent) {
        savePosition();
        if (!player.getPlayWhenReady() || player.getMediaItemCount() == 0) stopSelf();
    }

    @Override
    public void onDestroy() {
        savePosition();
        handler.removeCallbacksAndMessages(null);
        sleepEndsAt = 0;
        session.release();
        player.release();
        super.onDestroy();
    }

    // ---------- biblioteca para Android Auto ----------
    private static MediaItem folder(String id, String title) {
        return new MediaItem.Builder().setMediaId(id).setMediaMetadata(new MediaMetadata.Builder()
                .setTitle(title).setIsBrowsable(true).setIsPlayable(false)
                .setMediaType(MediaMetadata.MEDIA_TYPE_FOLDER_PODCASTS).build()).build();
    }

    private List<MediaItem> items(String key) {
        List<MediaItem> out = new ArrayList<>();
        for (JSONObject o : StationStore.library(this, key)) out.add(StationStore.toMediaItem(o));
        return out;
    }

    private class LibraryCallback implements MediaLibrarySession.Callback {
        @NonNull
        @Override
        public ListenableFuture<LibraryResult<MediaItem>> onGetLibraryRoot(
                @NonNull MediaLibrarySession s, @NonNull MediaSession.ControllerInfo b, @Nullable LibraryParams params) {
            return Futures.immediateFuture(LibraryResult.ofItem(folder("root", "Orbe Podcasts"), params));
        }

        @NonNull
        @Override
        public ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> onGetChildren(
                @NonNull MediaLibrarySession s, @NonNull MediaSession.ControllerInfo b, @NonNull String parentId,
                int page, int pageSize, @Nullable LibraryParams params) {
            switch (parentId) {
                case "root":
                    return Futures.immediateFuture(LibraryResult.ofItemList(ImmutableList.of(
                            folder("recents", "Seguir escuchando"), folder("nuevos", "Episodios nuevos")), params));
                case "recents":
                case "nuevos":
                    return Futures.immediateFuture(LibraryResult.ofItemList(items(parentId), params));
                default:
                    return Futures.immediateFuture(LibraryResult.ofItemList(ImmutableList.of(), params));
            }
        }

        @NonNull
        @Override
        public ListenableFuture<LibraryResult<MediaItem>> onGetItem(
                @NonNull MediaLibrarySession s, @NonNull MediaSession.ControllerInfo b, @NonNull String mediaId) {
            JSONObject ep = StationStore.find(PlaybackService.this, mediaId);
            if (ep == null) return Futures.immediateFuture(LibraryResult.ofError(LibraryResult.RESULT_ERROR_BAD_VALUE));
            return Futures.immediateFuture(LibraryResult.ofItem(StationStore.toMediaItem(ep), null));
        }

        /** Completa la dirección del audio de los episodios elegidos desde Android Auto o desde la app. */
        @NonNull
        @Override
        public ListenableFuture<List<MediaItem>> onAddMediaItems(
                @NonNull MediaSession s, @NonNull MediaSession.ControllerInfo c, @NonNull List<MediaItem> items) {
            List<MediaItem> out = new ArrayList<>();
            for (MediaItem it : items) {
                JSONObject ep = null;
                Bundle ex = it.mediaMetadata.extras;
                if (ex != null) ep = StationStore.parse(ex.getString("json"));
                if (ep == null) ep = StationStore.find(PlaybackService.this, it.mediaId);
                if (ep != null) {
                    StationStore.setLast(PlaybackService.this, ep);
                    out.add(StationStore.toMediaItem(ep));
                } else if (it.localConfiguration != null) {
                    out.add(it);
                } else if (it.requestMetadata.mediaUri != null) {
                    out.add(it.buildUpon().setUri(it.requestMetadata.mediaUri).build());
                }
            }
            return Futures.immediateFuture(out);
        }

        /** Desde Android Auto: retoma cada episodio donde quedó. */
        @NonNull
        @Override
        public ListenableFuture<MediaSession.MediaItemsWithStartPosition> onSetMediaItems(
                @NonNull MediaSession s, @NonNull MediaSession.ControllerInfo c, @NonNull List<MediaItem> items, int startIndex, long startPositionMs) {
            return Futures.transform(onAddMediaItems(s, c, items), list -> {
                int idx = startIndex == C.INDEX_UNSET ? 0 : Math.min(startIndex, Math.max(0, list.size() - 1));
                long pos = startPositionMs;
                if ((pos == C.TIME_UNSET || pos == 0) && !list.isEmpty()) pos = StationStore.position(PlaybackService.this, list.get(idx).mediaId);
                return new MediaSession.MediaItemsWithStartPosition(list, idx, pos);
            }, Runnable::run);
        }

        /** "Reanudar" desde el sistema (Android 13+): vuelve al último episodio, donde quedó. */
        @NonNull
        @Override
        public ListenableFuture<MediaSession.MediaItemsWithStartPosition> onPlaybackResumption(
                @NonNull MediaSession s, @NonNull MediaSession.ControllerInfo c) {
            JSONObject last = StationStore.getLast(PlaybackService.this);
            List<MediaItem> list = new ArrayList<>();
            long pos = 0;
            if (last != null) { list.add(StationStore.toMediaItem(last)); pos = StationStore.position(PlaybackService.this, last.optString("id")); }
            return Futures.immediateFuture(new MediaSession.MediaItemsWithStartPosition(list, 0, pos));
        }
    }
}
