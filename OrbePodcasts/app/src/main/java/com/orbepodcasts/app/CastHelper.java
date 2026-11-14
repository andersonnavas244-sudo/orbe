package com.orbepodcasts.app;

import android.app.Activity;
import android.net.Uri;
import android.view.ContextThemeWrapper;

import androidx.mediarouter.app.MediaRouteChooserDialog;
import androidx.mediarouter.app.MediaRouteControllerDialog;
import androidx.mediarouter.media.MediaRouteSelector;

import com.google.android.gms.cast.MediaInfo;
import com.google.android.gms.cast.MediaLoadRequestData;
import com.google.android.gms.cast.MediaMetadata;
import com.google.android.gms.cast.framework.CastContext;
import com.google.android.gms.cast.framework.CastSession;
import com.google.android.gms.cast.framework.SessionManagerListener;
import com.google.android.gms.cast.framework.media.RemoteMediaClient;
import com.google.android.gms.common.images.WebImage;

import org.json.JSONObject;

import java.util.concurrent.Executors;

/** Envía el episodio a un Chromecast, Google TV o parlante con Google Cast (misma red Wi-Fi). */
public class CastHelper implements SessionManagerListener<CastSession> {

    public interface Callback {
        void onCastState(boolean connected, String deviceName);
        void onCastStarted();
        void onCastEnded();
        JSONObject currentEpisode();
        long currentPosition();
    }

    private final Activity activity;
    private final Callback cb;
    private CastContext ctx;

    public CastHelper(Activity activity, Callback cb) {
        this.activity = activity;
        this.cb = cb;
        try {
            CastContext.getSharedInstance(activity, Executors.newSingleThreadExecutor())
                    .addOnSuccessListener(c -> activity.runOnUiThread(() -> {
                        ctx = c;
                        c.getSessionManager().addSessionManagerListener(this, CastSession.class);
                        report();
                    }));
        } catch (Exception ignored) { /* sin Google Play Services */ }
    }

    private CastSession session() { return ctx == null ? null : ctx.getSessionManager().getCurrentCastSession(); }

    private RemoteMediaClient client() {
        CastSession s = session();
        return s == null ? null : s.getRemoteMediaClient();
    }

    public boolean isCasting() {
        CastSession s = session();
        return s != null && s.isConnected();
    }

    public boolean showDialog() {
        if (ctx == null) return false;
        ContextThemeWrapper themed = new ContextThemeWrapper(activity, androidx.appcompat.R.style.Theme_AppCompat_NoActionBar);
        if (isCasting()) {
            new MediaRouteControllerDialog(themed).show();
        } else {
            MediaRouteSelector sel = ctx.getMergedSelector();
            MediaRouteChooserDialog d = new MediaRouteChooserDialog(themed);
            if (sel != null) d.setRouteSelector(sel);
            d.show();
        }
        return true;
    }

    public void load(JSONObject ep, long startMs) {
        RemoteMediaClient rmc = client();
        if (rmc == null || ep == null) return;
        String url = ep.optString("url");
        MediaMetadata md = new MediaMetadata(MediaMetadata.MEDIA_TYPE_GENERIC);
        md.putString(MediaMetadata.KEY_TITLE, ep.optString("title"));
        md.putString(MediaMetadata.KEY_SUBTITLE, ep.optString("podcast"));
        String img = ep.optString("art");
        if (img.startsWith("http")) md.addImage(new WebImage(Uri.parse(img)));
        String lower = url.toLowerCase();
        String type = lower.contains(".m3u8") ? "application/x-mpegURL" : lower.contains(".m4a") || lower.contains(".aac") ? "audio/mp4" : "audio/mpeg";
        MediaInfo info = new MediaInfo.Builder(url)
                .setStreamType(MediaInfo.STREAM_TYPE_BUFFERED)
                .setContentType(type)
                .setMetadata(md)
                .build();
        rmc.load(new MediaLoadRequestData.Builder().setMediaInfo(info).setAutoplay(true).setCurrentTime(Math.max(0, startMs)).build());
    }

    public void toggle() { RemoteMediaClient r = client(); if (r != null) r.togglePlayback(); }

    public void seekBy(long deltaMs) {
        RemoteMediaClient r = client();
        if (r != null) r.seek(new com.google.android.gms.cast.MediaSeekOptions.Builder().setPosition(Math.max(0, r.getApproximateStreamPosition() + deltaMs)).build());
    }

    public void seekTo(long ms) {
        RemoteMediaClient r = client();
        if (r != null) r.seek(new com.google.android.gms.cast.MediaSeekOptions.Builder().setPosition(Math.max(0, ms)).build());
    }

    /** [posición, duración, sonando(1/0)] en el televisor. */
    public long[] progress() {
        RemoteMediaClient r = client();
        if (r == null) return null;
        return new long[]{r.getApproximateStreamPosition(), r.getStreamDuration(), r.isPlaying() ? 1 : 0};
    }

    private void report() {
        CastSession s = session();
        boolean on = s != null && s.isConnected();
        cb.onCastState(on, on && s.getCastDevice() != null ? s.getCastDevice().getFriendlyName() : "");
    }

    @Override public void onSessionStarted(CastSession s, String id) { report(); long pos = cb.currentPosition(); cb.onCastStarted(); load(cb.currentEpisode(), pos); }
    @Override public void onSessionResumed(CastSession s, boolean wasSuspended) { report(); }
    @Override public void onSessionEnded(CastSession s, int error) { report(); cb.onCastEnded(); }
    @Override public void onSessionStarting(CastSession s) { }
    @Override public void onSessionStartFailed(CastSession s, int error) { report(); }
    @Override public void onSessionEnding(CastSession s) { }
    @Override public void onSessionResuming(CastSession s, String id) { }
    @Override public void onSessionResumeFailed(CastSession s, int error) { report(); }
    @Override public void onSessionSuspended(CastSession s, int reason) { }

    public void release() {
        if (ctx != null) ctx.getSessionManager().removeSessionManagerListener(this, CastSession.class);
    }
}
