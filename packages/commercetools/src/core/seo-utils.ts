import type { LocalizedString } from '@commercetools/platform-sdk';
import type { Seo } from '@reactionary/core';

/**
 * commercetools has no robots field, so only the authored meta title and description are mapped.
 * Blank values count as not authored.
 */
export function parseCommercetoolsSeo(
  language: string,
  data: { metaTitle?: LocalizedString; metaDescription?: LocalizedString },
): Seo | undefined {
  const title = data.metaTitle?.[language]?.trim() || undefined;
  const description = data.metaDescription?.[language]?.trim() || undefined;

  if (title === undefined && description === undefined) {
    return undefined;
  }

  const seo: Seo = {};
  if (title !== undefined) seo.title = title;
  if (description !== undefined) seo.description = description;
  return seo;
}
