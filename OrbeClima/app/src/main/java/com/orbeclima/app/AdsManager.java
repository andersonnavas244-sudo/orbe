package com.orbeclima.app;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.util.DisplayMetrics;
import android.view.View;
import android.widget.FrameLayout;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
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
 * Anuncios: banner pequeño fijo abajo + anuncios a pantalla completa con límite
 * ({@link AdsConfig#INTERSTITIALS_PER_WINDOW} cada {@link AdsConfig#WINDOW_MS}).
 * Pide el consentimiento (UMP) antes de cargar nada. Con Premium no hay anuncios.
 */
public class AdsManager {

    private static AdsManager instance;

    /** El gestor activo (para mostrar anuncios desde otras pantallas, p. ej. el reproductor). */
    public static AdsManager get() { return instance; }

    private final Activity activity;
    private final Context app;
    private final FrameLayout bannerContainer;
    private final AtomicBoolean started = new AtomicBoolean(false);
    private AdView banner;
    private InterstitialAd interstitial;
    private boolean loadingInterstitial;

    public AdsManager(Activity activity, FrameLayout bannerContainer) {
        this.activity = activity;
        this.app = activity.getApplicationContext();
        this.bannerContainer = bannerContainer;
        instance = this;
    }

    /** Pide consentimiento (solo se muestra en la UE/Reino Unido) y luego carga anuncios. */
    public void start() {
        if (StationStore.isPremium(activity)) return; // Premium: sin anuncios
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
                activity.runOnUiThread(() -> {
                    loadBanner();
                    loadInterstitial();
                }))).start();
    }

    private void loadBanner() {
        banner = new AdView(activity);
        banner.setAdUnitId(AdsConfig.BANNER_ID);
        DisplayMetrics dm = activity.getResources().getDisplayMetrics();
        int widthDp = (int) (dm.widthPixels / dm.density);
        banner.setAdSize(AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(activity, widthDp));
        banner.setAdListener(new AdListener() {
            @Override public void onAdLoaded() { bannerContainer.setVisibility(View.VISIBLE); }
            @Override public void onAdFailedToLoad(LoadAdError e) { bannerContainer.setVisibility(View.GONE); }
        });
        bannerContainer.removeAllViews();
        bannerContainer.addView(banner);
        banner.loadAd(new AdRequest.Builder().build());
    }

    private void loadInterstitial() {
        if (loadingInterstitial || interstitial != null) return;
        loadingInterstitial = true;
        InterstitialAd.load(app, AdsConfig.INTERSTITIAL_ID, new AdRequest.Builder().build(),
                new InterstitialAdLoadCallback() {
                    @Override public void onAdLoaded(InterstitialAd ad) { interstitial = ad; loadingInterstitial = false; }
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
        if (StationStore.isPremium(app) || !started.get() || interstitial == null) return false;
        if (sinceLastAd() < AdsConfig.MIN_GAP_MS) return false;
        return recentShows().length() < AdsConfig.INTERSTITIALS_PER_WINDOW;
    }

    private void recordShow() {
        long now = System.currentTimeMillis();
        JSONArray r = recentShows().put(now);
        prefs().edit().putString("shown", r.toString()).putLong("last", now).apply();
    }

    /** Muestra el anuncio en la pantalla principal (si toca) y luego ejecuta {@code then}. */
    public void showInterstitialThen(Runnable then) { showInterstitialThen(activity, then); }

    /**
     * Muestra el anuncio sobre {@code host} si el límite lo permite y, al cerrarlo, ejecuta
     * {@code then}. Si no toca anuncio, ejecuta {@code then} de inmediato.
     */
    public void showInterstitialThen(Activity host, Runnable then) {
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
        ad.show(host);
    }

    /** Al comprar Premium se quitan los anuncios al instante. */
    public void disable() {
        interstitial = null;
        if (banner != null) { banner.destroy(); banner = null; }
        bannerContainer.removeAllViews();
        bannerContainer.setVisibility(View.GONE);
    }

    public void onResume() { if (banner != null) banner.resume(); }
    public void onPause() { if (banner != null) banner.pause(); }
    public void onDestroy() {
        if (banner != null) banner.destroy();
        if (instance == this) instance = null;
    }
}
