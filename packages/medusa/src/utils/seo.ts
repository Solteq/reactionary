import type { RequestContext, Seo } from '@reactionary/core';
import { safeStringConvert } from './medusa-helpers.js';

/**
 * Medusa does not translate metadata, so authored SEO values live in flat keys:
 * `seo_title_<locale>` and `seo_description_<locale>` (e.g. `seo_title_da-DK`), and a single
 * `seo_robots`. The exact request locale wins, then the bare language (`seo_title_da`).
 * Another language is never borrowed, so an unauthored locale stays empty and falls through to the read-time fallback.
 */
export const SEO_METADATA_PREFIX = 'seo_';

function localizedValue(
  metadata: Record<string, unknown>,
  field: 'title' | 'description',
  locale: string,
): string | undefined {
  const language = locale.split('-')[0];
  const candidates = language && language !== locale ? [locale, language] : [locale];
  for (const candidate of candidates) {
    const value = safeStringConvert(metadata[`seo_${field}_${candidate}`])?.trim();
    if (value) {
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
  const title = localizedValue(metadata, 'title', locale);
  const description = localizedValue(metadata, 'description', locale);
  const robots = safeStringConvert(metadata['seo_robots'])?.trim() || undefined;

  if (title === undefined && description === undefined && robots === undefined) {
    return undefined;
  }

  const seo: Seo = {};
  if (title !== undefined) seo.title = title;
  if (description !== undefined) seo.description = description;
  if (robots !== undefined) seo.robots = robots;
  return seo;
}
