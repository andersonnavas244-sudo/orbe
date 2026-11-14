package com.orbeclima.app;

/**
 * Fuentes de datos de Orbe Clima. Todas gratuitas y permiten uso comercial (la app tiene anuncios y Premium):
 *
 *  - MET Norway (Instituto Meteorológico de Noruega): pronóstico de cada lugar y alertas.
 *    Licencia CC BY 4.0 / NLOD. Pide identificar la app en cada consulta (USER_AGENT) y usar caché.
 *  - NOAA GFS (dominio público de EE. UU.) vía el ERDDAP de PacIOOS: mapa mundial de viento, lluvia,
 *    temperatura y humedad. El workflow de GitHub lo publica cada 6 horas en MIRROR_URL.
 *  - OpenStreetMap Nominatim: buscador de ciudades (una búsqueda por toque).
 *  - GDACS (Comisión Europea y ONU): ciclones tropicales.
 */
public final class ClimaConfig {
    private ClimaConfig() { }

    /** Copia del mapa mundial que publica el workflow de GitHub cada 6 horas. */
    public static final String MIRROR_URL = "https://andersonnavas244-sudo.github.io/orbe/clima/grid.json";

    /** Identificación que exige MET Norway (nombre de la app + dirección del proyecto). */
    public static final String USER_AGENT = "OrbeClima/1.1 (+https://github.com/andersonnavas244-sudo/orbe)";

    public static final String MET_FORECAST = "https://api.met.no/weatherapi/locationforecast/2.0/complete";
}
