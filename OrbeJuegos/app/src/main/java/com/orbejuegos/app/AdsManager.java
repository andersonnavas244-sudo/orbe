package com.orbejuegos.app;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

import org.json.JSONArray;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Anuncios a pantalla completa entre partidas, con límite
 * ({@link AdsConfig#INTERSTITIALS_PER_WINDOW} cada {@link AdsConfig#WINDOW_MS}). Sin banner.
 * Pide el consentimiento (UMP) antes de cargar nada. Con Premium no hay anuncios.
 */
public class AdsManager {

    private final Activity activity;
    private final Context app;
    private final AtomicBoolean started = new AtomicBoolean(false);
    private InterstitialAd interstitial;
    private boolean loadingInterstitial;
    private boolean disabled;

    public AdsManager(Activity activity) {
        this.activity = activity;
        this.app = activity.getApplicationContext();
    }

    /** Pide consentimiento (solo se muestra en la UE/Reino Unido) y luego carga anuncios. */
    public void start() {
        if (Prefs.isPremium(activity)) return; // Premium: sin anuncios
        ConsentInformation consent = UserMessagingPlatform.getConsentInformation(activity);
        consent.requestConsentInfoUpdate(activity, new ConsentRequestParameters.Builder().build(),
                () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity, formError -> {
                    if (consent.canRequestAds()) initAds();
                }),
                requestError -> { /* sin conexión: se intenta con lo ya guardado */ });
        if (consent.canRequestAds()) initAds();
    }

    private void initAds() {
        if (!started.compareAndSet(false, true)) return;
        new Thread(() -> MobileAds.initialize(activity, status ->
                activity.runOnUiThread(this::loadInterstitial))).start();
    }

    private void loadInterstitial() {
        if (disabled || loadingInterstitial || interstitial != null) return;
        loadingInterstitial = true;
        InterstitialAd.load(app, AdsConfig.INTERSTITIAL_ID, new AdRequest.Builder().build(),
                new InterstitialAdLoadCallback() {
                    @Override public void onAdLoaded(InterstitialAd ad) { interstitial = disabled ? null : ad; loadingInterstitial = false; }
                    @Override public void onAdFailedToLoad(LoadAdError e) { interstitial = null; loadingInterstitial = false; }
                });
    }

    // ---------- límite: N anuncios por ventana de tiempo (se guarda aunque se cierre la app) ----------
    private SharedPreferences prefs() { return app.getSharedPreferences("ads", Context.MODE_PRIVATE); }

    private JSONArray recentShows() {
        JSONArray out = new JSONArray();
        long now = System.currentTimeMillis();
        try {
            JSONArray all = new JSONArray(prefs().getString("shown", "[]"));
            for (int i = 0; i < all.length(); i++) if (now - all.optLong(i) < AdsConfig.WINDOW_MS) out.put(all.optLong(i));
        } catch (Exception ignored) { }
        return out;
    }

    /** Milisegundos desde el último anuncio a pantalla completa (muy grande si nunca hubo). */
    public long sinceLastAd() {
        return System.currentTimeMillis() - prefs().getLong("last", 0);
    }

    /** true si ahora se puede mostrar un anuncio a pantalla completa. */
    public boolean canShow() {
        if (disabled || Prefs.isPremium(app) || !started.get() || interstitial == null) return false;
        if (sinceLastAd() < AdsConfig.MIN_GAP_MS) return false;
        return recentShows().length() < AdsConfig.INTERSTITIALS_PER_WINDOW;
    }

    private void recordShow() {
        long now = System.currentTimeMillis();
        JSONArray r = recentShows().put(now);
        prefs().edit().putString("shown", r.toString()).putLong("last", now).apply();
    }

    /**
     * Muestra el anuncio si el límite lo permite y, al cerrarlo, ejecuta {@code then}.
     * Si no toca anuncio, ejecuta {@code then} de inmediato.
     */
    public void showInterstitialThen(Runnable then) {
        if (!canShow()) {
            then.run();
            if (started.get()) loadInterstitial();
            return;
        }
        InterstitialAd ad = interstitial;
        interstitial = null;
        AtomicBoolean done = new AtomicBoolean(false);
        Runnable finish = () -> { if (done.compareAndSet(false, true)) then.run(); loadInterstitial(); };
        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override public void onAdDismissedFullScreenContent() { finish.run(); }
            @Override public void onAdFailedToShowFullScreenContent(AdError e) { finish.run(); }
        });
        recordShow();
        ad.show(activity);
    }

    /** Al comprar Premium se quitan los anuncios al instante. */
    public void disable() {
        disabled = true;
        interstitial = null;
    }
}
