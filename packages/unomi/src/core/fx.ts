/** EUR per one unit of a currency, and when that rate applies (the start of a day, UTC, as an ISO date and time). */
export interface EurRate {
  readonly rate: number;
  readonly date: string;
}

export interface FxConfig {
  /** The ECB daily reference rates (XML). An empty string turns the fetch off, so only the fallback table is used. */
  readonly fxRatesUrl: string;
  /** EUR per one unit of the currency, used when the ECB rates cannot be had or lack the currency. */
  readonly fxFallbackRates: Readonly<Record<string, number>>;
}

interface EcbDay {
  /** ISO date of the reference rates. */
  readonly date: string;
  /** Units of the currency per EUR, as the ECB publishes them. */
  readonly perEur: Readonly<Record<string, number>>;
}

const TTL_MS = 24 * 60 * 60 * 1000;
const FAILURE_TTL_MS = 10 * 60 * 1000;
const TIMEOUT_MS = 2000;

const cache = new Map<string, { expires: number; day: Promise<EcbDay | undefined> }>();

/** Forgets the cached ECB rates. For tests. */
export function clearFxCache(): void {
  cache.clear();
}

/** The reference rates of an ECB `eurofxref-daily.xml` document. */
export function parseEcbRates(xml: string): EcbDay | undefined {
  const date = /<Cube\s+time=['"](\d{4}-\d{2}-\d{2})['"]/.exec(xml)?.[1];
  if (!date) {
    return undefined;
  }
  const perEur: Record<string, number> = {};
  for (const match of xml.matchAll(/<Cube\s+currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g)) {
    const rate = Number(match[2]);
    if (rate > 0) {
      perEur[match[1]] = rate;
    }
  }
  return Object.keys(perEur).length > 0 ? { date, perEur } : undefined;
}

async function fetchEcb(url: string): Promise<EcbDay | undefined> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    return response.ok ? parseEcbRates(await response.text()) : undefined;
  } catch {
    return undefined;
  }
}

function ecbDay(url: string, now: number): Promise<EcbDay | undefined> {
  const hit = cache.get(url);
  if (hit && hit.expires > now) {
    return hit.day;
  }
  const day = fetchEcb(url);
  const entry = { expires: now + TTL_MS, day };
  cache.set(url, entry);
  // A failed fetch is retried soon, not after a day.
  void day.then((value) => {
    if (value === undefined) {
      entry.expires = now + FAILURE_TTL_MS;
    }
  });
  return day;
}

function startOfDay(now: number): string {
  return `${new Date(now).toISOString().slice(0, 10)}T00:00:00.000Z`;
}

/**
 * The EUR rate of a currency: the ECB reference rate of the latest day when it can be had, otherwise the configured fallback,
 * otherwise nothing. The rate is fixed on the event when it is sent and never restated.
 */
export async function eurRate(currency: string, config: FxConfig, now: number = Date.now()): Promise<EurRate | undefined> {
  if (currency === 'EUR') {
    return { rate: 1, date: startOfDay(now) };
  }
  if (config.fxRatesUrl) {
    const day = await ecbDay(config.fxRatesUrl, now);
    const perEur = day?.perEur[currency];
    if (day && perEur) {
      // Eight significant digits: a fixed number of decimals loses too much for a currency worth a tiny fraction of a euro.
      return { rate: Number((1 / perEur).toPrecision(8)), date: `${day.date}T00:00:00.000Z` };
    }
  }
  const fallback = config.fxFallbackRates[currency];
  return fallback ? { rate: fallback, date: startOfDay(now) } : undefined;
}

/** An amount in EUR at `rate`, to cents. */
export function toEur(value: number, rate: EurRate): number {
  return Math.round(value * rate.rate * 100) / 100;
}
