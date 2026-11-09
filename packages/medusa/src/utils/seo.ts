import type { RequestContext, Seo } from '@reactionary/core';

/**
 * Medusa does not translate metadata, so authored SEO values live in flat keys:
 * `seo_title_<locale>` and `seo_description_<locale>` (e.g. `seo_title_da-DK`).
 * The exact request locale wins, then the bare language (`seo_title_da`).
 * Another language is never borrowed, so an unauthored locale stays empty and falls through to the read-time fallback.
 *
 * Locale suffixes match regardless of case and of `-` versus `_`, as the keys are often typed by hand in the admin.
 * Only string values count as authored.
 */
const TITLE_PREFIX = 'seo_title_';
const DESCRIPTION_PREFIX = 'seo_description_';
// Written by recalcitrant for other consumers (e.g. an edge service). It is not part of the model,
// but it is still ours, so it is kept out of the generic product attributes.
const ROBOTS_KEY = 'seo_robots';

/**
 * True for the metadata keys written by recalcitrant for SEO, so they can be kept out of the generic attributes.
 * Other `seo_` keys a merchant may have are left alone.
 */
export function isMedusaSeoMetadataKey(key: string): boolean {
  return key === ROBOTS_KEY || key.startsWith(TITLE_PREFIX) || key.startsWith(DESCRIPTION_PREFIX);
}

function normalizeLocale(locale: string): string {
  return locale.trim().toLowerCase().replace(/_/g, '-');
}

function authoredString(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() || undefined : undefined;
}

function localizedValue(
  metadata: Record<string, unknown>,
  prefix: string,
  locale: string,
): string | undefined {
  const exact = normalizeLocale(locale);
  const language = exact.split('-')[0];
  const candidates = language && language !== exact ? [exact, language] : [exact];

  const byLocale = new Map<string, string>();
  for (const [key, value] of Object.entries(metadata)) {
    if (!key.startsWith(prefix)) {
      continue;
    }
    const authored = authoredString(value);
    const keyLocale = normalizeLocale(key.slice(prefix.length));
    if (authored !== undefined && !byLocale.has(keyLocale)) {
      byLocale.set(keyLocale, authored);
    }
  }

  for (const candidate of candidates) {
    const value = byLocale.get(candidate);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

export function parseMedusaSeo(
  context: RequestContext,
  metadata: Record<string, unknown> | null | undefined,
): Seo | undefined {
  if (!metadata) {
    return undefined;
  }
  const locale = context.languageContext.locale;
  const title = localizedValue(metadata, TITLE_PREFIX, locale);
  const description = localizedValue(metadata, DESCRIPTION_PREFIX, locale);

  if (title === undefined && description === undefined) {
    return undefined;
  }

  const seo: Seo = {};
  if (title !== undefined) seo.title = title;
  if (description !== undefined) seo.description = description;
  return seo;
}
