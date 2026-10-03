import { MemoryCache, type LanguageContext } from '@reactionary/core';
import { describe, expect, it } from 'vitest';
import { parseAcceptLanguage, type ReactionaryUCPLocalizationOptions } from './reactionary-ucp-localization.js';
import { ReactionaryUCPServer } from './reactionary-ucp-server.js';

const localization: ReactionaryUCPLocalizationOptions = {
  rules: [
    { country: 'SE', languageContext: { locale: 'sv-SE', currencyCode: 'SEK' } },
    { language: 'da', languageContext: { locale: 'da-DK', currencyCode: 'DKK' } },
    { language: 'en-GB', languageContext: { locale: 'en-GB', currencyCode: 'GBP' } },
  ],
  fallback: { locale: 'en-US', currencyCode: 'EUR' },
};

function createObservingServer(
  options: { localization?: ReactionaryUCPLocalizationOptions } = { localization },
) {
  const observed: LanguageContext[] = [];
  const server = new ReactionaryUCPServer(
    (requestContext) => {
      observed.push({ ...requestContext.languageContext });
      return {};
    },
    { sessionCache: new MemoryCache(), ...options },
  );

  return { server, observed };
}

describe('parseAcceptLanguage', () => {
  it('orders tags by quality and drops wildcards', () => {
    expect(parseAcceptLanguage('en;q=0.8, da, *;q=0.1, sv;q=0.9')).toEqual(['da', 'sv', 'en']);
    expect(parseAcceptLanguage(null)).toEqual([]);
  });
});

describe('ReactionaryUCPServer localization', () => {
  it('maps Accept-Language to a configured language context', async () => {
    const { server, observed } = createObservingServer();

    await server.fetch(
      new Request('http://127.0.0.1/ucp', {
        headers: { 'accept-language': 'da-DK,en;q=0.8' },
      }),
    );

    expect(observed[0]).toEqual({ locale: 'da-DK', currencyCode: 'DKK' });
  });

  it('prefers the UCP context country signal over Accept-Language', async () => {
    const { server, observed } = createObservingServer();

    await server.fetch(
      new Request('http://127.0.0.1/ucp/carts', {
        method: 'POST',
        headers: { 'accept-language': 'da' },
        body: JSON.stringify({
          line_items: [],
          context: { address_country: 'se' },
        }),
      }),
    );

    expect(observed[0]).toEqual({ locale: 'sv-SE', currencyCode: 'SEK' });
  });

  it('falls back when nothing matches and keeps defaults without configuration', async () => {
    const { server, observed } = createObservingServer();

    await server.fetch(
      new Request('http://127.0.0.1/ucp', {
        headers: { 'accept-language': 'fr-FR' },
      }),
    );

    expect(observed[0]).toEqual({ locale: 'en-US', currencyCode: 'EUR' });

    const plain = createObservingServer({});
    await plain.server.fetch(
      new Request('http://127.0.0.1/ucp', {
        headers: { 'accept-language': 'da' },
      }),
    );

    expect(plain.observed[0]).toEqual({ locale: 'da-DK', currencyCode: 'DKK' });
  });

  it('sticks to the negotiated context for the rest of the session', async () => {
    const { server, observed } = createObservingServer();

    const first = await server.fetch(
      new Request('http://127.0.0.1/ucp', {
        headers: { 'accept-language': 'en-GB' },
      }),
    );
    const sessionId = first.headers.get('ucp-session-id');

    // The same session renegotiates nothing, even with a different header:
    // the backend fixed the cart currency when the session's first cart was
    // created, so the context must not drift away from it.
    await server.fetch(
      new Request('http://127.0.0.1/ucp', {
        headers: {
          'accept-language': 'da',
          'ucp-session-id': sessionId ?? '',
        },
      }),
    );

    // A fresh session negotiates independently.
    await server.fetch(
      new Request('http://127.0.0.1/ucp', {
        headers: { 'accept-language': 'da' },
      }),
    );

    expect(observed[0]).toEqual({ locale: 'en-GB', currencyCode: 'GBP' });
    expect(observed[1]).toEqual({ locale: 'en-GB', currencyCode: 'GBP' });
    expect(observed[2]).toEqual({ locale: 'da-DK', currencyCode: 'DKK' });
  });
});
