package com.orbejuegos.app;

/**
 * Configuración de anuncios (AdMob).
 *
 * IMPORTANTE: el ID de abajo es el ID DE PRUEBA oficial de Google. Muestra anuncios
 * de ejemplo y no genera dinero. Para ganar dinero:
 *   1. Crea una cuenta en https://admob.google.com y registra la app.
 *   2. Crea un bloque "Intersticial".
 *   3. Pega aquí su ID y pon el ID de la app en res/values/strings.xml (admob_app_id).
 * Nunca hagas clic en tus propios anuncios reales: AdMob puede suspender la cuenta.
 *
 * En Juegos de Colombia no hay banner: los controles del tejo y del billar van abajo y un banner
 * estorbaría el juego. Solo hay anuncio a pantalla completa entre partidas (Revancha / Menú).
 */
public final class AdsConfig {
    private AdsConfig() { }

    /** Anuncio a pantalla completa que se muestra entre partidas. */
    public static final String INTERSTITIAL_ID = "ca-app-pub-3940256099942544/1033173712";

    /** Límite de anuncios a pantalla completa: 2 cada 40 minutos (se cuenta aunque se cierre la app). */
    public static final int INTERSTITIALS_PER_WINDOW = 2;
    public static final long WINDOW_MS = 40 * 60_000L;

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
