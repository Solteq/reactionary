import type { RequestContext } from '@reactionary/core';

/**
 * Magento provisions one store view per language beneath a shared base store
 * code, named `{storeBaseCode}-{language}` — a `b2c` base with a `da-DK`
 * request locale resolves to the `b2c-da` store view.
 */
export const MAGENTO_STORE_VIEW_SEPARATOR = '-';

/**
 * The language segment of a store view code: the first two characters of the
 * request locale, lowercased. Locales arrive as IETF BCP 47 tags (`da-DK`,
 * `en-US`), but underscore-separated (`da_DK`) and bare (`da`) forms are read
 * just as happily. Anything that does not start with two letters yields
 * `undefined` so the caller can fall back to the base store code.
 */
export function extractStoreViewLanguage(locale: unknown): string | undefined {
  if (typeof locale !== 'string') {
    return undefined;
  }

  const match = /^([A-Za-z]{2})/.exec(locale.trim());
  return match ? match[1].toLowerCase() : undefined;
}

/**
 * Resolve the Magento store view code for a request.
 *
 * Falls back to the bare base store code whenever no usable language can be
 * read out of the locale, and to an empty code when no base code is
 * configured — which leaves Magento to serve its own default store view.
 */
export function resolveMagentoStoreViewCode(
  storeBaseCode: unknown,
  locale?: unknown,
): string {
  const base = typeof storeBaseCode === 'string' ? storeBaseCode.trim() : '';
  if (!base) {
    return '';
  }

  const language = extractStoreViewLanguage(locale);
  return language ? `${base}${MAGENTO_STORE_VIEW_SEPARATOR}${language}` : base;
}

/**
 * The locale of the current request, or `undefined` when the context carries
 * no language information.
 */
export function getRequestLocale(context?: RequestContext): string | undefined {
  const locale = context?.languageContext?.locale;
  return typeof locale === 'string' && locale.trim() ? locale : undefined;
}

/**
 * Convenience wrapper over {@link resolveMagentoStoreViewCode} that reads the
 * locale straight off the request context.
 */
export function resolveMagentoStoreViewCodeForContext(
  storeBaseCode: unknown,
  context?: RequestContext,
): string {
  return resolveMagentoStoreViewCode(storeBaseCode, getRequestLocale(context));
}
