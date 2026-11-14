package com.orbeespacio.app;

/**
 * Configuración de anuncios (AdMob).
 *
 * IMPORTANTE: los IDs de abajo son los IDs DE PRUEBA oficiales de Google. Muestran anuncios
 * de ejemplo y no generan dinero. Para ganar dinero:
 *   1. Crea una cuenta en https://admob.google.com y registra la app.
 *   2. Crea un bloque "Banner" y otro "Intersticial".
 *   3. Pega aquí sus IDs y pon el ID de la app en res/values/strings.xml (admob_app_id).
 * Nunca hagas clic en tus propios anuncios reales: AdMob puede suspender la cuenta.
 */
public final class AdsConfig {
    private AdsConfig() { }

    /** Banner pequeño fijo en la parte inferior. */
    public static final String BANNER_ID = "ca-app-pub-3940256099942544/9214589741";

    /** Anuncio a pantalla completa que se muestra al abrir un enlace externo. */
    public static final String INTERSTITIAL_ID = "ca-app-pub-3940256099942544/1033173712";

    /**
     * Límite de anuncios a pantalla completa: 2 cada 40 minutos (se cuenta aunque se cierre la app).
     * Uno al elegir un canal/emisora y otro tras 20 minutos seguidos viendo o escuchando.
     */
    public static final int INTERSTITIALS_PER_WINDOW = 2;
    public static final long WINDOW_MS = 40 * 60_000L;

    /** Viendo o escuchando sin parar: un anuncio cada 20 minutos (dentro del límite). 0 = desactivado. */
    public static final long MID_ROLL_EVERY_MS = 20 * 60_000L;

    /** Separación mínima entre dos anuncios, para que nunca salgan seguidos. */
    public static final long MIN_GAP_MS = 2 * 60_000L;

    /**
     * Suscripción mensual "Premium sin anuncios". Créala en Play Console
     * (Monetizar → Suscripciones) con este id y un plan base mensual de 9.000 COP
     * (Play convierte el precio a la moneda de cada país).
     */
    public static final String PREMIUM_PRODUCT_ID = "premium_mensual";

    /** Precio que se muestra mientras Google Play no responde (el real lo pone Play Console). */
    public static final String PREMIUM_FALLBACK_PRICE = "$9.000 COP/mes";
}
