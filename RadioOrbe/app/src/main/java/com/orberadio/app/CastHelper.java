package com.orberadio.app;

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

/** Envía la emisora a un Chromecast / Google TV de la misma red Wi-Fi. */
public class CastHelper implements SessionManagerListener<CastSession> {

    public interface Callback {
        void onCastState(boolean connected, String deviceName);
        void onCastStarted();      // pausar el audio del teléfono
        void onCastEnded();        // seguir en el teléfono
        JSONObject currentStation();
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

    private CastSession session() {
        return ctx == null ? null : ctx.getSessionManager().getCurrentCastSession();
    }

    public boolean isCasting() {
        CastSession s = session();
        return s != null && s.isConnected();
    }

    /** Muestra la lista de televisores, o el control del que ya está conectado. */
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

    public void load(JSONObject st) {
        CastSession s = session();
        if (s == null || st == null) return;
        RemoteMediaClient rmc = s.getRemoteMediaClient();
        if (rmc == null) return;
        String url = st.optString("url");
        MediaMetadata md = new MediaMetadata(MediaMetadata.MEDIA_TYPE_MUSIC_TRACK);
        md.putString(MediaMetadata.KEY_TITLE, st.optString("name"));
        md.putString(MediaMetadata.KEY_ARTIST, st.optString("sub"));
        String img = st.optString("img");
        if (img.startsWith("http")) md.addImage(new WebImage(Uri.parse(img)));
        String lower = url.toLowerCase();
        String type = lower.contains(".m3u8") ? "application/x-mpegURL"
                : lower.contains("aac") ? "audio/aac" : lower.contains("ogg") ? "audio/ogg" : "audio/mpeg";
        MediaInfo info = new MediaInfo.Builder(url)
                .setStreamType(MediaInfo.STREAM_TYPE_LIVE)
                .setContentType(type)
                .setMetadata(md)
                .build();
        rmc.load(new MediaLoadRequestData.Builder().setMediaInfo(info).setAutoplay(true).build());
    }

    public void toggle() {
        CastSession s = session();
        RemoteMediaClient rmc = s == null ? null : s.getRemoteMediaClient();
        if (rmc != null) rmc.togglePlayback();
    }

    private void report() {
        CastSession s = session();
        boolean on = s != null && s.isConnected();
        cb.onCastState(on, on && s.getCastDevice() != null ? s.getCastDevice().getFriendlyName() : "");
    }

    @Override public void onSessionStarted(CastSession s, String id) { report(); cb.onCastStarted(); load(cb.currentStation()); }
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
