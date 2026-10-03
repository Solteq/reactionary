import { LanguageContextSchema, type LanguageContext, type Session } from '@reactionary/core';

/**
 * Maps a buyer signal — the UCP `context.address_country` of a request payload,
 * or an `Accept-Language` language tag — to a language context. Mirrors the
 * mapping frontends maintain today, since neither the core store model nor the
 * providers carry a locale/currency catalogue yet.
 */
export interface ReactionaryUCPLocalizationRule {
  /** ISO 3166-1 alpha-2 country code matched against `context.address_country`, case-insensitive. */
  country?: string;
  /** BCP 47 language tag matched against `Accept-Language` tags, case-insensitive; `da` matches `da-DK`. */
  language?: string;
  languageContext: LanguageContext;
}

export interface ReactionaryUCPLocalizationOptions {
  rules: ReactionaryUCPLocalizationRule[];
  /** Used when no rule matches. Without it, the server's initial context stays in effect. */
  fallback?: LanguageContext;
}

/**
 * Default Nordic-oriented mapping: Sweden → SEK, Norway → NOK, Denmark → DKK,
 * Finland → EUR, and English-speaking buyers → USD. Country signals match
 * first; the language rules catch buyers whose requests only carry
 * Accept-Language.
 */
export const DEFAULT_UCP_LOCALIZATION_RULES: ReactionaryUCPLocalizationRule[] = [
  { country: 'SE', languageContext: { locale: 'sv-SE', currencyCode: 'SEK' } },
  { country: 'NO', languageContext: { locale: 'nb-NO', currencyCode: 'NOK' } },
  { country: 'DK', languageContext: { locale: 'da-DK', currencyCode: 'DKK' } },
  { country: 'FI', languageContext: { locale: 'fi-FI', currencyCode: 'EUR' } },
  { language: 'sv', languageContext: { locale: 'sv-SE', currencyCode: 'SEK' } },
  { language: 'nb', languageContext: { locale: 'nb-NO', currencyCode: 'NOK' } },
  { language: 'nn', languageContext: { locale: 'nb-NO', currencyCode: 'NOK' } },
  { language: 'no', languageContext: { locale: 'nb-NO', currencyCode: 'NOK' } },
  { language: 'da', languageContext: { locale: 'da-DK', currencyCode: 'DKK' } },
  { language: 'fi', languageContext: { locale: 'fi-FI', currencyCode: 'EUR' } },
  { language: 'en', languageContext: { locale: 'en-US', currencyCode: 'USD' } },
];

const SESSION_LANGUAGE_CONTEXT_KEY = 'dev.ucp.languageContext';

/**
 * Resolves the language context for a request. The result is persisted in the
 * session and reused for every later request of that session: backends fix a
 * cart's currency and locale at creation, so renegotiating mid-session would
 * detach the context from the carts and checkouts the session already created.
 */
export async function resolveLanguageContext(
  request: Request,
  session: Session,
  options: ReactionaryUCPLocalizationOptions | undefined,
): Promise<LanguageContext | undefined> {
  if (!options) {
    return undefined;
  }

  const stored = LanguageContextSchema.safeParse(session[SESSION_LANGUAGE_CONTEXT_KEY]);
  if (stored.success) {
    return stored.data;
  }

  const resolved = await negotiateLanguageContext(request, options);
  if (resolved) {
    session[SESSION_LANGUAGE_CONTEXT_KEY] = resolved;
  }

  return resolved;
}

async function negotiateLanguageContext(
  request: Request,
  options: ReactionaryUCPLocalizationOptions,
): Promise<LanguageContext | undefined> {
  const country = await peekContextCountry(request);
  if (country) {
    const byCountry = options.rules.find(
      (rule) => rule.country && rule.country.toUpperCase() === country,
    );

    if (byCountry) {
      return byCountry.languageContext;
    }
  }

  for (const language of parseAcceptLanguage(request.headers.get('accept-language'))) {
    const byLanguage = options.rules.find(
      (rule) => rule.language && languageMatches(rule.language, language),
    );

    if (byLanguage) {
      return byLanguage.languageContext;
    }
  }

  return options.fallback;
}

/**
 * Reads the UCP `context.address_country` buyer signal from a JSON request
 * payload without consuming the body the route handlers will parse.
 */
async function peekContextCountry(request: Request): Promise<string | undefined> {
  if ((request.method !== 'POST' && request.method !== 'PUT') || !request.body) {
    return undefined;
  }

  try {
    const body: unknown = await request.clone().json();

    if (typeof body !== 'object' || body === null) {
      return undefined;
    }

    const context = (body as Record<string, unknown>)['context'];
    if (typeof context !== 'object' || context === null) {
      return undefined;
    }

    const countryValue = (context as Record<string, unknown>)['address_country'];

    return typeof countryValue === 'string' && countryValue.length > 0
      ? countryValue.toUpperCase()
      : undefined;
  } catch {
    return undefined;
  }
}

/** Returns the accepted language tags, highest quality first, `*` excluded. */
export function parseAcceptLanguage(header: string | null): string[] {
  if (!header) {
    return [];
  }

  return header
    .split(',')
    .map((entry) => {
      const [tag, ...parameters] = entry.trim().split(';');
      const qualityParameter = parameters
        .map((parameter) => parameter.trim())
        .find((parameter) => parameter.startsWith('q='));
      const quality = qualityParameter ? Number.parseFloat(qualityParameter.slice(2)) : 1;

      return {
        tag: tag.trim(),
        quality: Number.isFinite(quality) ? quality : 0,
      };
    })
    .filter((entry) => entry.tag.length > 0 && entry.tag !== '*' && entry.quality > 0)
    .sort((left, right) => right.quality - left.quality)
    .map((entry) => entry.tag);
}

function languageMatches(ruleLanguage: string, acceptedTag: string): boolean {
  const rule = ruleLanguage.toLowerCase();
  const tag = acceptedTag.toLowerCase();

  return rule === tag || tag.startsWith(`${rule}-`) || rule.startsWith(`${tag}-`);
}
