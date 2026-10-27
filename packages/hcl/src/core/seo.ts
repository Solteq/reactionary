import type { Seo } from '@reactionary/core';
import type { HclSeoPage } from '../schema/hcl.schema.js';

/**
 * Maps the SEO page that /api/v2/urls attaches to a URL token.
 * HCL fills these from SEO page templates, so the values are HCL's own resolved defaults
 * when nothing was authored for the entity. They are passed on as they are.
 * Keywords and the page redirect are not part of the model.
 */
export function parseHclSeo(page: HclSeoPage | undefined): Seo | undefined {
  const title = page?.title?.trim() || undefined;
  const description = page?.metaDescription?.trim() || undefined;

  if (title === undefined && description === undefined) {
    return undefined;
  }

  const seo: Seo = {};
  if (title !== undefined) seo.title = title;
  if (description !== undefined) seo.description = description;
  return seo;
}
