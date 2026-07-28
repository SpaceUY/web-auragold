/**
 * Serie histórica real para el simulador de inflación vs. oro (/calculadora-inflacion-oro).
 *
 * Inflación anual de México (CPI, % anual): Banco Mundial (FP.CPI.TOTL.ZG) / INEGI.
 * Cruzada contra las cifras ya citadas en /blog/evolucion-inflacion-mexico
 * (2017≈6%, 2018≈4.9%, 2020≈3.4%, 2022≈7.9%, 2023≈5.5%, 2024≈4.7%): coincide.
 *
 * Precio del oro en pesos por onza troy (promedio anual):
 * - 2018-2025: mismos valores ya publicados en /precio-del-oro-hoy (no se duplican
 *   ni contradicen con una fuente distinta).
 * - 2009-2017: precio del oro promedio anual en USD (LBMA) × tipo de cambio
 *   promedio anual USD/MXN (Banxico/mercado). El valor de 2015 (18,000) coincide
 *   con el ejemplo ya citado en /precio-del-oro-hoy.
 *
 * Último año oficial cerrado: 2025. El valor "hoy" se alimenta con el precio del
 * oro en vivo (CoinGecko), no con estos datos históricos.
 */

export const LAST_CLOSED_YEAR = 2025;

export const INFLATION_RATE_BY_YEAR: Record<number, number> = {
  2009: 5.297,
  2010: 4.157,
  2011: 3.407,
  2012: 4.112,
  2013: 3.806,
  2014: 4.019,
  2015: 2.721,
  2016: 2.822,
  2017: 6.041,
  2018: 4.899,
  2019: 3.636,
  2020: 3.397,
  2021: 5.689,
  2022: 7.896,
  2023: 5.528,
  2024: 4.722,
  2025: 3.81,
};

export const GOLD_PRICE_MXN_PER_OZ_BY_YEAR: Record<number, number> = {
  2009: 13100,
  2010: 15450,
  2011: 19550,
  2012: 21950,
  2013: 18000,
  2014: 16850,
  2015: 18000,
  2016: 23400,
  2017: 23800,
  2018: 22300,
  2019: 26800,
  2020: 34400,
  2021: 33000,
  2022: 32700,
  2023: 37600,
  2024: 45900,
  2025: 63400,
};

export const START_YEARS = Object.keys(GOLD_PRICE_MXN_PER_OZ_BY_YEAR)
  .map(Number)
  .sort((a, b) => a - b);

/** Factor acumulado de inflación desde el 1/ene del año `from` hasta el cierre de LAST_CLOSED_YEAR. */
export function cumulativeInflationFactor(from: number): number {
  let factor = 1;
  for (let year = from; year <= LAST_CLOSED_YEAR; year++) {
    const rate = INFLATION_RATE_BY_YEAR[year];
    if (rate === undefined) continue;
    factor *= 1 + rate / 100;
  }
  return factor;
}

/** Serie año por año del factor acumulado de inflación desde `from` (para graficar). */
export function inflationFactorSeries(from: number): { year: number; factor: number }[] {
  const series: { year: number; factor: number }[] = [{ year: from, factor: 1 }];
  let factor = 1;
  for (let year = from; year <= LAST_CLOSED_YEAR; year++) {
    const rate = INFLATION_RATE_BY_YEAR[year];
    if (rate === undefined) continue;
    factor *= 1 + rate / 100;
    series.push({ year: year + 1, factor });
  }
  return series;
}
