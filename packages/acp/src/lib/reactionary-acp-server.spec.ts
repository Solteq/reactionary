import {
  MemoryCache,
  createInitialRequestContext,
  error,
  success,
  type GenericError,
  type NotFoundError,
  type Order,
  type Cart,
  type Checkout,
  type Currency,
  type Inventory,
  type Price,
  type Product,
  type ProductSearchResult,
  type RequestContext,
} from '@reactionary/core';
import { describe, expect, it, vi } from 'vitest';
import type { ReactionaryFeedClient } from '@reactionary/feeds';
import { ReactionaryACPFeedPublisher } from './acp-feed-publisher.js';
import { createTokenizedCardHandler } from './acp-payment-handlers.js';
import { signWebhookPayload } from './acp-webhooks.js';
import {
  ReactionaryACPServer,
  createBearerTokenAuthenticator,
  type ACPLink,
  type ReactionaryACPClient,
} from './reactionary-acp-server.js';

const fulfillmentDetails = {
  name: 'Ada Lovelace',
  address: {
    name: 'Ada Lovelace',
    line_one: '1 Computing Street',
    city: 'London',
    state: 'London',
    country: 'GB',
    postal_code: 'SW1A 1AA',
  },
};

const paymentHandlers = [createTokenizedCardHandler({ psp: 'stripe', merchantId: 'acct_123' })];

function cardPayment(token: string) {
  return {
    handler_id: 'card_tokenized',
    instrument: { type: 'card', credential: { type: 'spt', token } },
  };
}

const agentCapabilities = { interventions: { supported: [] } };

const selectStandardShipping = {
  selected_fulfillment_options: [{ type: 'shipping', option_id: 'standard', item_ids: [] }],
};

describe('ReactionaryACPServer', () => {
  it('does not initialize when the client is missing required operations', () => {
    expect(
      () => new ReactionaryACPServer(() => ({}) as ReactionaryACPClient),
    ).toThrow(
      'Reactionary ACP server cannot initialize because the client is missing required operations',
    );
  });

  it('creates fetch and Node handlers', () => {
    const server = new ReactionaryACPServer(() => createTestClient());

    expect(typeof server.getHandler().fetch).toBe('function');
    expect(typeof server.toNodeHandler()).toBe('function');
  });

  it('serves an ACP readiness response', async () => {
    const server = new ReactionaryACPServer(() => createTestClient(), {
      name: 'test-acp',
      version: '1.2.3',
    });

    const response = await server.fetch(new Request('http://127.0.0.1/acp'));
    const body = await json<Record<string, unknown>>(response);

    expect(response.status).toBe(200);
    expect(response.headers.get('acp-session-id')).toBeTruthy();
    expect(body).toMatchObject({
      name: 'test-acp',
      version: '1.2.3',
      protocol: 'acp',
      status: 'ready',
    });
    expect(body['actions']).toEqual(
      expect.arrayContaining([
        'POST /checkout_sessions',
        'POST /checkout_sessions/{checkout_session_id}/complete',
      ]),
    );
  });

  it('serves an ACP discovery document at the well-known paths', async () => {
    const server = new ReactionaryACPServer(() => createTestClient());

    for (const path of ['/.well-known/acp.json', '/.well-known/acp']) {
      const response = await server.fetch(new Request(`https://shop.example.com${path}`));

      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('public, max-age=3600');
      expect(await json<Record<string, unknown>>(response)).toEqual({
        protocol: {
          name: 'acp',
          version: '2026-04-17',
          supported_versions: ['2026-04-17'],
        },
        api_base_url: 'https://shop.example.com/acp',
        transports: ['rest'],
        capabilities: { services: ['checkout', 'carts'] },
      });
    }
  });

  it('advertises only services from the closed discovery enum', async () => {
    const server = new ReactionaryACPServer(() => createTestClient());
    const discovery = await json<{ capabilities: { services: string[] } }>(
      await server.fetch(new Request('https://shop.example.com/.well-known/acp.json')),
    );

    expect(discovery.capabilities.services).toEqual(['checkout', 'carts']);
  });

  it('advertises the interventions the seller supports', async () => {
    const server = new ReactionaryACPServer(() => createTestClient(), {
      interventions: { supported: ['3ds', 'address_verification'] },
    });
    const discovery = await json<{ capabilities: Record<string, unknown> }>(
      await server.fetch(new Request('https://shop.example.com/.well-known/acp.json')),
    );

    expect(discovery.capabilities['intervention_types']).toEqual(['3ds', 'address_verification']);
    expect(discovery.capabilities['extensions']).toBeUndefined();
  });

  it('honours discovery options and omits the HEAD body', async () => {
    const server = new ReactionaryACPServer(() => createTestClient(), {
      discovery: {
        apiBaseUrl: 'https://api.example.com/acp',
        supportedCurrencies: ['EUR'],
      },
    });

    const response = await server.fetch(
      new Request('https://shop.example.com/.well-known/acp.json'),
    );
    expect(await json<Record<string, unknown>>(response)).toMatchObject({
      api_base_url: 'https://api.example.com/acp',
      protocol: { supported_versions: ['2026-04-17'] },
      capabilities: { supported_currencies: ['EUR'] },
    });

    const head = await server.fetch(
      new Request('https://shop.example.com/.well-known/acp.json', { method: 'HEAD' }),
    );
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
  });

  it('rejects checkout requests without a supported API-Version', async () => {
    const server = new ReactionaryACPServer(() => createTestClient());
    const body = JSON.stringify({ line_items: [{ id: 'sku-1', quantity: 1 }], currency: 'eur' });

    const missing = await server.fetch(new Request('http://127.0.0.1/checkout_sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    }));

    expect(missing.status).toBe(400);
    await expect(missing.json()).resolves.toEqual({
      type: 'invalid_request',
      code: 'missing_api_version',
      message: 'The API-Version header is required.',
      supported_versions: ['2026-04-17'],
    });

    const unsupported = await server.fetch(new Request('http://127.0.0.1/checkout_sessions/checkout_session_1', {
      headers: { 'api-version': '2025-09-29' },
    }));

    expect(unsupported.status).toBe(400);
    await expect(unsupported.json()).resolves.toMatchObject({
      code: 'unsupported_api_version',
      supported_versions: ['2026-04-17'],
    });
  });

  it('persists request context session state by ACP session id', async () => {
    const observedSessions: RequestContext['session'][] = [];
    const server = new ReactionaryACPServer(
      (requestContext) => {
        observedSessions.push({ ...requestContext.session });
        requestContext.session['test.marker'] = 'saved';
        return createTestClient();
      },
      { sessionCache: new MemoryCache(), paymentHandlers },
    );

    const first = await server.fetch(new Request('http://127.0.0.1/acp'));
    const sessionId = first.headers.get('acp-session-id');

    expect(sessionId).toBeTruthy();

    await server.fetch(
      new Request('http://127.0.0.1/acp', {
        headers: {
          'acp-session-id': sessionId ?? '',
        },
      }),
    );

    expect(observedSessions[2]?.['test.marker']).toBe('saved');
  });

  it('creates, retrieves, and completes ACP checkout sessions', async () => {
    const server = new ReactionaryACPServer(() => createTestClient(), {
      sessionCache: new MemoryCache(),
      paymentHandlers,
    });

    const createResponse = await server.fetch(
      jsonRequest('http://127.0.0.1/checkout_sessions', {
        line_items: [{ id: 'sku-1', quantity: 2 }],
        currency: 'eur',
        capabilities: agentCapabilities,
        buyer: {
          first_name: 'Ada',
          last_name: 'Lovelace',
          email: 'ada@example.com',
        },
        fulfillment_details: fulfillmentDetails,
      }),
    );
    const created = await json<{ id: string }>(createResponse);

    expect(createResponse.status).toBe(201);
    expect(created).toMatchObject({ protocol: { version: '2026-04-17' } });
    expect(JSON.stringify(created)).not.toContain('delivery_time');
    // Payable only once a fulfillment option has been picked.
    expect(created).toMatchObject({
      status: 'not_ready_for_payment',
      currency: 'eur',
      fulfillment_options: [{
        type: 'shipping',
        id: 'standard',
        title: 'Standard shipping',
        description: '3-5 business days',
        carrier: 'Reactionary',
        totals: [{ type: 'total', display_text: 'Standard shipping', amount: 500 }],
      }],
      line_items: [
        {
          item: { id: 'sku-1' },
          quantity: 2,
          name: 'Test variant',
          images: ['https://cdn.example/sku-1.png'],
          unit_amount: 1000,
          product_id: 'product-1',
          sku: 'sku-1',
          totals: [
            { type: 'items_base_amount', display_text: 'Base Amount', amount: 2000 },
            { type: 'subtotal', display_text: 'Subtotal', amount: 2000 },
            { type: 'total', display_text: 'Total', amount: 2000 },
          ],
        },
      ],
    });

    const updateResponse = await server.fetch(
      jsonRequest(`http://127.0.0.1/checkout_sessions/${created.id}`, {
        ...selectStandardShipping,
      }),
    );
    await expect(updateResponse.json()).resolves.toMatchObject({
      id: created.id,
      status: 'ready_for_payment',
      selected_fulfillment_options: [{ type: 'shipping', option_id: 'standard' }],
    });

    const getResponse = await server.fetch(
      getRequest(`http://127.0.0.1/checkout_sessions/${created.id}`),
    );
    await expect(getResponse.json()).resolves.toMatchObject({
      id: created.id,
      status: 'ready_for_payment',
    });

    const completeResponse = await server.fetch(
      jsonRequest(`http://127.0.0.1/checkout_sessions/${created.id}/complete`, {
        buyer: {
          first_name: 'Ada',
          last_name: 'Lovelace',
          email: 'ada@example.com',
        },
        payment_data: cardPayment('spt_test'),
      }),
    );
    const completed = await json<Record<string, unknown>>(completeResponse);

    expect(completeResponse.status).toBe(200);
    expect(completed).toMatchObject({
      id: created.id,
      status: 'completed',
      fulfillment_options: [{ id: 'standard' }],
      selected_fulfillment_options: [{ option_id: 'standard' }],
      order: {
        checkout_session_id: created.id,
      },
    });
  });

  it('adds up requested quantities, accepts decimals and prices in the requested currency', async () => {
    const currencies: string[] = [];
    const server = new ReactionaryACPServer((requestContext) => {
      currencies.push(requestContext.languageContext.currencyCode);
      return createTestClient();
    }, { sessionCache: new MemoryCache(), paymentHandlers });

    const response = await server.fetch(
      jsonRequest('http://127.0.0.1/checkout_sessions', {
        line_items: [{ id: 'sku-1' }, { id: 'sku-1', quantity: 1.5 }],
        currency: 'sek',
        capabilities: agentCapabilities,
      }),
    );
    const created = await json<{ id: string }>(response);

    expect(response.status).toBe(201);
    expect(created).toMatchObject({
      line_items: [{ item: { id: 'sku-1' }, quantity: 2.5 }],
    });

    await server.fetch(getRequest(`http://127.0.0.1/checkout_sessions/${created.id}`));

    expect(currencies.slice(1)).toEqual(['SEK', 'SEK']);
  });

  it('accepts the 2026-04-17 buyer and merges buyer updates', async () => {
    const server = new ReactionaryACPServer(() => createTestClient(), { sessionCache: new MemoryCache(), paymentHandlers });
    const created = await json<{ id: string; buyer: unknown }>(await server.fetch(
      jsonRequest('http://127.0.0.1/checkout_sessions', {
        line_items: [{ id: 'sku-1' }],
        currency: 'eur',
        capabilities: agentCapabilities,
        buyer: {
          first_name: 'Ada',
          last_name: 'Lovelace',
          email: 'ada@example.com',
          account_type: 'business',
          company: { name: 'Analytical Engines Ltd', tax_id: 'GB123' },
        },
      }),
    ));

    expect(created.buyer).toEqual({
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@example.com',
      account_type: 'business',
      company: { name: 'Analytical Engines Ltd', tax_id: 'GB123' },
    });

    const updated = await json<{ buyer: unknown }>(await server.fetch(
      jsonRequest(`http://127.0.0.1/checkout_sessions/${created.id}`, {
        buyer: { email: 'ada@engines.example', phone_number: '+441234567890' },
      }),
    ));

    expect(updated.buyer).toMatchObject({
      first_name: 'Ada',
      email: 'ada@engines.example',
      phone_number: '+441234567890',
    });

    const invalid = await server.fetch(
      jsonRequest(`http://127.0.0.1/checkout_sessions/${created.id}`, { buyer: { first_name: 'Ada' } }),
    );

    expect(invalid.status).toBe(400);
  });

  it('takes the contact from fulfillment details and clears fields set to null', async () => {
    const server = new ReactionaryACPServer(() => createTestClient(), { sessionCache: new MemoryCache(), paymentHandlers });
    const created = await json<{ id: string }>(await server.fetch(
      jsonRequest('http://127.0.0.1/checkout_sessions', {
        line_items: [{ id: 'sku-1' }],
        currency: 'eur',
        capabilities: agentCapabilities,
        fulfillment_details: { ...fulfillmentDetails, email: 'ada@example.com' },
      }),
    ));
    const url = `http://127.0.0.1/checkout_sessions/${created.id}`;

    const ready = await json<Record<string, unknown>>(await server.fetch(jsonRequest(url, selectStandardShipping)));

    expect(ready).toMatchObject({
      status: 'ready_for_payment',
      fulfillment_details: { email: 'ada@example.com', address: { city: 'London' } },
      selected_fulfillment_options: [{ option_id: 'standard' }],
    });

    const unselected = await json<Record<string, unknown>>(await server.fetch(
      jsonRequest(url, { selected_fulfillment_options: null }),
    ));

    expect(unselected['status']).toBe('not_ready_for_payment');
    expect(unselected['selected_fulfillment_options']).toBeUndefined();

    const cleared = await json<Record<string, unknown>>(await server.fetch(
      jsonRequest(url, { fulfillment_details: null }),
    ));

    expect(cleared['fulfillment_details']).toBeUndefined();
    expect(cleared['fulfillment_options']).toEqual([]);
  });

  it('negotiates interventions and blocks sessions whose required interventions the agent lacks', async () => {
    const server = new ReactionaryACPServer(() => createTestClient(), {
      sessionCache: new MemoryCache(),
      paymentHandlers,
      interventions: { supported: ['3ds', 'address_verification'], required: ['3ds'], enforcement: 'always' },
    });
    const create = (supported: string[]) => server.fetch(jsonRequest('http://127.0.0.1/checkout_sessions', {
      line_items: [{ id: 'sku-1' }],
      currency: 'eur',
      capabilities: { interventions: { supported, display_context: 'webview' }, extensions: ['discount'] },
      buyer: { email: 'ada@example.com' },
      fulfillment_details: fulfillmentDetails,
    }));

    const capable = await json<Record<string, unknown>>(await create(['3ds', 'biometric', 'future_type']));

    expect(capable['capabilities']).toMatchObject({
      interventions: { supported: ['3ds'], required: ['3ds'], enforcement: 'always' },
    });
    expect(capable['messages']).not.toContainEqual(expect.objectContaining({ code: 'intervention_required' }));

    const incapable = await json<Record<string, unknown>>(await create([]));

    expect(incapable['capabilities']).toMatchObject({ interventions: { supported: [] } });
    expect(incapable['status']).toBe('not_ready_for_payment');
    expect(incapable['messages']).toContainEqual(expect.objectContaining({ type: 'error', code: 'intervention_required' }));

    const missing = await server.fetch(jsonRequest('http://127.0.0.1/checkout_sessions', {
      line_items: [{ id: 'sku-1' }],
      currency: 'eur',
    }));

    expect(missing.status).toBe(400);
  });

  it('advertises configured payment handlers in the session capabilities', async () => {
    const server = new ReactionaryACPServer(() => createTestClient(), {
      sessionCache: new MemoryCache(),
      paymentHandlers: [
        createTokenizedCardHandler({
          psp: 'stripe',
          merchantId: 'acct_123',
          displayName: 'Credit Card',
          acceptedBrands: ['visa', 'mastercard'],
        }),
      ],
    });

    const created = await json<Record<string, unknown>>(await server.fetch(
      jsonRequest('http://127.0.0.1/checkout_sessions', {
        line_items: [{ id: 'sku-1' }],
        currency: 'eur',
        capabilities: agentCapabilities,
      }),
    ));

    expect(created['payment_provider']).toBeUndefined();
    expect(created['capabilities']).toMatchObject({
      payment: {
        handlers: [{
          id: 'card_tokenized',
          name: 'dev.acp.tokenized.card',
          display_name: 'Credit Card',
          version: '2026-01-22',
          spec: 'https://acp.dev/handlers/tokenized.card',
          requires_delegate_payment: true,
          requires_pci_compliance: false,
          psp: 'stripe',
          config_schema: 'https://acp.dev/schemas/handlers/tokenized.card/config.json',
          instrument_schemas: ['https://acp.dev/schemas/handlers/tokenized.card/instrument.json'],
          config: { merchant_id: 'acct_123', psp: 'stripe', accepted_brands: ['visa', 'mastercard'] },
        }],
      },
    });
  });

  it('only accepts payments for advertised handlers and refuses raw card numbers', async () => {
    const server = new ReactionaryACPServer(() => createTestClient(), {
      sessionCache: new MemoryCache(),
      paymentHandlers,
      paymentAuthorizationWait: { timeoutMs: 0 },
    });
    const created = await json<{ id: string }>(await server.fetch(jsonRequest('http://127.0.0.1/checkout_sessions', {
      line_items: [{ id: 'sku-1' }],
      currency: 'eur',
      capabilities: agentCapabilities,
      buyer: { email: 'ada@example.com' },
      fulfillment_details: fulfillmentDetails,
    })));
    const complete = (payment_data: unknown) => server.fetch(
      jsonRequest(`http://127.0.0.1/checkout_sessions/${created.id}/complete`, { payment_data }),
    );

    const unknownHandler = await complete({ ...cardPayment('spt_1'), handler_id: 'paypal' });

    expect(unknownHandler.status).toBe(400);
    await expect(unknownHandler.json()).resolves.toMatchObject({ param: '$.payment_data.handler_id' });

    const rawCard = await complete({
      handler_id: 'card_tokenized',
      instrument: { type: 'card', credential: { type: 'card', token: 'x', number: '4242424242424242' } },
    });

    expect(rawCard.status).toBe(400);
    await expect(rawCard.json()).resolves.toMatchObject({ param: '$.payment_data.instrument.credential' });

    const legacy = await server.fetch(jsonRequest(`http://127.0.0.1/checkout_sessions/${created.id}/complete`, {
      payment_data: { token: 'spt_1', provider: 'stripe' },
    }));

    expect(legacy.status).toBe(400);
  });

  it('refuses payment handlers without a merchant account', () => {
    const handler = createTokenizedCardHandler({ psp: 'stripe', merchantId: '' });

    expect(() => new ReactionaryACPServer(() => createTestClient(), { paymentHandlers: [handler] }))
      .toThrow('must configure merchant_id');
  });

  it('reports amounts in the minor units of the currency', async () => {
    const amounts = async (currency: Currency) => {
      const server = new ReactionaryACPServer(() => createTestClient({ currency }), { sessionCache: new MemoryCache() });
      const created = await json<{ totals: Array<{ type: string; amount: number }>; line_items: Array<{ unit_amount: number }> }>(
        await server.fetch(jsonRequest('http://127.0.0.1/checkout_sessions', {
          line_items: [{ id: 'sku-1', quantity: 2 }],
          currency: currency.toLowerCase(),
          capabilities: agentCapabilities,
        })),
      );

      return {
        unit: created.line_items[0]?.unit_amount,
        total: created.totals.find((total) => total.type === 'total')?.amount,
      };
    };

    await expect(amounts('EUR')).resolves.toEqual({ unit: 1000, total: 2000 });
    await expect(amounts('JPY')).resolves.toEqual({ unit: 10, total: 20 });
    await expect(amounts('KWD')).resolves.toEqual({ unit: 10000, total: 20000 });
  });

  it('returns the configured policy links', async () => {
    const links = [
      { type: 'terms_of_use', url: 'https://shop.example/terms' },
      { type: 'return_policy', title: 'Returns', url: 'https://shop.example/returns' },
      { type: 'support', title: 'Help', url: 'https://shop.example/help' },
    ] satisfies ACPLink[];
    const server = new ReactionaryACPServer(() => createTestClient(), { sessionCache: new MemoryCache(), links });
    const created = await json<{ links: unknown }>(await server.fetch(jsonRequest('http://127.0.0.1/checkout_sessions', {
      line_items: [{ id: 'sku-1' }],
      currency: 'eur',
      capabilities: agentCapabilities,
    })));

    expect(created.links).toEqual(links);
  });

  it('authenticates agents and scopes checkout sessions to the creating agent', async () => {
    const server = new ReactionaryACPServer(() => createTestClient(), {
      sessionCache: new MemoryCache(),
      authenticate: createBearerTokenAuthenticator({ chatgpt: 'token-a', other: 'token-b' }),
    });
    const create = (authorization?: string) => {
      const request = jsonRequest('http://127.0.0.1/checkout_sessions', {
        line_items: [{ id: 'sku-1' }],
        currency: 'eur',
        capabilities: agentCapabilities,
      });
      if (authorization) {
        request.headers.set('authorization', authorization);
      }
      return server.fetch(request);
    };

    const anonymous = await create();

    expect(anonymous.status).toBe(401);
    expect(anonymous.headers.get('www-authenticate')).toBe('Bearer');
    await expect(anonymous.json()).resolves.toMatchObject({ code: 'unauthorized' });
    expect((await create('Bearer wrong')).status).toBe(401);

    const created = await json<{ id: string }>(await create('Bearer token-a'));
    const read = (token: string) => {
      const request = getRequest(`http://127.0.0.1/checkout_sessions/${created.id}`);
      request.headers.set('authorization', `Bearer ${token}`);
      return server.fetch(request);
    };

    expect((await read('token-a')).status).toBe(200);
    expect((await read('token-b')).status).toBe(404);

    const discovery = await server.fetch(new Request('http://127.0.0.1/.well-known/acp.json'));

    expect(discovery.status).toBe(200);
  });

  it('replays POSTs by Idempotency-Key and rejects conflicting or missing keys', async () => {
    const payments: unknown[] = [];
    const server = new ReactionaryACPServer(() => createTestClient({ payments }), {
      sessionCache: new MemoryCache(),
      paymentHandlers,
      paymentAuthorizationWait: { timeoutMs: 0 },
    });
    const post = (url: string, body: unknown, key?: string) => server.fetch(new Request(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'api-version': '2026-04-17',
        ...(key ? { 'idempotency-key': key } : {}),
      },
      body: JSON.stringify(body),
    }));
    const createBody = {
      line_items: [{ id: 'sku-1' }],
      currency: 'eur',
      capabilities: agentCapabilities,
      buyer: { email: 'ada@example.com' },
      fulfillment_details: fulfillmentDetails,
    };

    const missing = await post('http://127.0.0.1/checkout_sessions', createBody);

    expect(missing.status).toBe(400);
    await expect(missing.json()).resolves.toMatchObject({ code: 'idempotency_key_required' });

    const first = await post('http://127.0.0.1/checkout_sessions', createBody, 'key-1');
    const created = await json<{ id: string }>(first);
    // Same body with a different key order is the same request.
    const replayed = await post(
      'http://127.0.0.1/checkout_sessions',
      Object.fromEntries(Object.entries(createBody).reverse()),
      'key-1',
    );

    expect(first.status).toBe(201);
    expect(replayed.status).toBe(201);
    expect(replayed.headers.get('idempotent-replayed')).toBe('true');
    await expect(replayed.json()).resolves.toMatchObject({ id: created.id });

    const conflict = await post('http://127.0.0.1/checkout_sessions', { ...createBody, currency: 'sek' }, 'key-1');

    expect(conflict.status).toBe(422);
    await expect(conflict.json()).resolves.toMatchObject({ code: 'idempotency_conflict' });

    // Concurrent completions with one key place one payment.
    await post(`http://127.0.0.1/checkout_sessions/${created.id}`, selectStandardShipping, 'key-2');
    const completeUrl = `http://127.0.0.1/checkout_sessions/${created.id}/complete`;
    const completions = await Promise.all([
      post(completeUrl, { payment_data: cardPayment('spt_1') }, 'key-3'),
      post(completeUrl, { payment_data: cardPayment('spt_1') }, 'key-3'),
    ]);

    expect(completions.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(completions.find((response) => response.status === 409)?.headers.get('retry-after')).toBe('1');
    expect(payments).toHaveLength(1);
  });

  it('echoes Request-Id and Idempotency-Key and localizes to the best supported locale', async () => {
    const locales: string[] = [];
    const server = new ReactionaryACPServer((requestContext) => {
      locales.push(requestContext.languageContext.locale);
      return createTestClient();
    }, {
      sessionCache: new MemoryCache(),
      discovery: { supportedLocales: ['en-US', 'fi-FI'] },
    });
    const request = jsonRequest('http://127.0.0.1/checkout_sessions', {
      line_items: [{ id: 'sku-1' }],
      currency: 'eur',
      capabilities: agentCapabilities,
    });
    request.headers.set('request-id', 'req_123');
    request.headers.set('idempotency-key', 'idem_123');
    request.headers.set('accept-language', 'sv-SE, fi;q=0.8, en;q=0.5');

    const response = await server.fetch(request);

    expect(response.status).toBe(201);
    expect(response.headers.get('request-id')).toBe('req_123');
    expect(response.headers.get('idempotency-key')).toBe('idem_123');
    expect(locales.at(-1)).toBe('fi-FI');

    const unsupported = getRequest('http://127.0.0.1/.well-known/acp.json');
    unsupported.headers.set('accept-language', 'sv-SE');
    await server.fetch(unsupported);

    expect(locales.at(-1)).toBe(createInitialRequestContext().languageContext.locale);
  });

  it('reports invalid requests at their JSONPath without exposing backend errors', async () => {
    const create = (server: ReactionaryACPServer, body: unknown) =>
      server.fetch(jsonRequest('http://127.0.0.1/checkout_sessions', body));
    const body = { line_items: [{ id: 'sku-1' }, { id: 'nope' }], currency: 'eur', capabilities: agentCapabilities };

    const unknownItem = await create(new ReactionaryACPServer(() => createTestClient({ unknownSkus: ['nope'] })), body);

    expect(unknownItem.status).toBe(400);
    await expect(unknownItem.json()).resolves.toEqual({
      type: 'invalid_request',
      code: 'not_found',
      message: 'The referenced resource does not exist.',
      param: '$.line_items[1].id',
    });

    const invalid = await create(new ReactionaryACPServer(() => createTestClient()), { ...body, line_items: [{ id: '' }] });

    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toMatchObject({ type: 'invalid_request', param: '$.line_items[0].id' });

    const missing = await create(new ReactionaryACPServer(() => createTestClient()), { line_items: body.line_items, currency: 'eur' });

    await expect(missing.json()).resolves.toMatchObject({ code: 'missing', param: '$.capabilities' });

    const failing = await create(new ReactionaryACPServer(() => createTestClient({ failCartCreation: true })), body);
    const failure = await failing.text();

    expect(failing.status).toBe(502);
    expect(JSON.parse(failure)).toMatchObject({ type: 'processing_error', code: 'backend_error' });
    expect(failure).not.toContain('credentials');
  });

  it('reports what the session still needs as messages', async () => {
    const server = new ReactionaryACPServer(() => createTestClient(), {
      sessionCache: new MemoryCache(),
      paymentHandlers,
      inventory: { fulfillmentCenterKeys: ['warehouse'] },
    });
    const created = await json<Record<string, unknown> & { id: string }>(await server.fetch(
      jsonRequest('http://127.0.0.1/checkout_sessions', {
        line_items: [{ id: 'sku-1', quantity: 6 }],
        currency: 'eur',
        capabilities: agentCapabilities,
      }),
    ));

    expect(created['status']).toBe('not_ready_for_payment');
    expect(created['messages']).toEqual([
      expect.objectContaining({ type: 'error', code: 'out_of_stock', param: '$.line_items[0]', content: 'Only 5 of sku-1 are in stock.' }),
      expect.objectContaining({ type: 'error', code: 'missing', param: '$.buyer.email', resolution: 'requires_buyer_input' }),
      expect.objectContaining({ type: 'error', code: 'missing', param: '$.fulfillment_details.address' }),
    ]);

    const url = `http://127.0.0.1/checkout_sessions/${created.id}`;
    const withAddress = await json<Record<string, unknown>>(await server.fetch(jsonRequest(url, {
      line_items: [{ id: 'sku-1', quantity: 1 }],
      buyer: { email: 'ada@example.com' },
      fulfillment_details: fulfillmentDetails,
    })));

    expect(withAddress['messages']).toEqual([
      expect.objectContaining({ code: 'missing', param: '$.selected_fulfillment_options' }),
    ]);

    const unknownOption = await json<Record<string, unknown>>(await server.fetch(jsonRequest(url, {
      selected_fulfillment_options: [{ type: 'shipping', option_id: 'teleport', item_ids: [] }],
    })));

    expect(unknownOption['status']).toBe('not_ready_for_payment');
    expect(unknownOption['selected_fulfillment_options']).toBeUndefined();
    expect(unknownOption['messages']).toEqual([
      expect.objectContaining({ code: 'invalid', param: '$.selected_fulfillment_options[0].option_id', resolution: 'recoverable' }),
    ]);

    const complete = await server.fetch(jsonRequest(`${url}/complete`, { payment_data: cardPayment('spt_1') }));

    expect(complete.status).toBe(400);
    await expect(complete.json()).resolves.toMatchObject({ code: 'invalid', param: '$.selected_fulfillment_options[0].option_id' });
  });

  it('requires an order id placeholder in the permalink template', () => {
    expect(() => new ReactionaryACPServer(() => createTestClient(), { orderPermalinkUrl: 'https://shop.example/orders' }))
      .toThrow('{orderId}');
  });

  it('requires a fulfillment option unless the store needs none', async () => {
    const statusOf = async (requireFulfillment: boolean | undefined) => {
      const server = new ReactionaryACPServer(() => createTestClient({ noShippingMethods: true }), {
        sessionCache: new MemoryCache(),
        ...(requireFulfillment === undefined ? {} : { requireFulfillment }),
      });
      return json<{ status: string; messages: unknown[] }>(await server.fetch(jsonRequest('http://127.0.0.1/checkout_sessions', {
        line_items: [{ id: 'sku-1' }],
        currency: 'eur',
        capabilities: agentCapabilities,
        buyer: { email: 'ada@example.com' },
        fulfillment_details: fulfillmentDetails,
      })));
    };

    const strict = await statusOf(undefined);

    expect(strict.status).toBe('not_ready_for_payment');
    expect(strict.messages).toEqual([expect.objectContaining({ code: 'region_restricted', param: '$.fulfillment_details.address' })]);
    await expect(statusOf(false)).resolves.toMatchObject({ status: 'ready_for_payment', messages: [] });
  });

  it('updates the session cart in place, or replaces and deletes it', async () => {
    const update = async (inPlaceCartUpdates: boolean) => {
      const cartCalls: string[] = [];
      const client = createTestClient({ cartCalls, inPlaceCartUpdates });
      const server = new ReactionaryACPServer(() => client, { sessionCache: new MemoryCache() });
      const created = await json<{ id: string }>(await server.fetch(jsonRequest('http://127.0.0.1/checkout_sessions', {
        line_items: [{ id: 'sku-1' }, { id: 'sku-2' }],
        currency: 'eur',
        capabilities: agentCapabilities,
      })));
      const updated = await json<{ line_items: Array<{ item: { id: string }; quantity: number }> }>(await server.fetch(
        jsonRequest(`http://127.0.0.1/checkout_sessions/${created.id}`, {
          line_items: [{ id: 'sku-1', quantity: 3 }, { id: 'sku-3' }],
        }),
      ));

      return {
        cartCalls,
        items: updated.line_items.map((lineItem) => [lineItem.item.id, lineItem.quantity]),
      };
    };

    await expect(update(true)).resolves.toEqual({
      cartCalls: ['createCart', 'changeQuantity:line-1:3', 'remove:line-2'],
      items: [['sku-1', 3], ['sku-3', 1]],
    });
    await expect(update(false)).resolves.toEqual({
      cartCalls: ['createCart', 'createCart', 'deleteCart:cart-1'],
      items: [['sku-1', 3], ['sku-3', 1]],
    });
  });

  it('creates a session without buyer data and no backend checkout', async () => {
    const initiated: unknown[] = [];
    const server = new ReactionaryACPServer(() => createTestClient({ initiated }), {
      sessionCache: new MemoryCache(),
      paymentHandlers,
    });

    const response = await server.fetch(
      jsonRequest('http://127.0.0.1/checkout_sessions', {
        line_items: [{ id: 'sku-1', quantity: 1 }],
        currency: 'eur',
        capabilities: agentCapabilities,
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      status: 'not_ready_for_payment',
      fulfillment_options: [],
      line_items: [{ item: { id: 'sku-1' }, quantity: 1 }],
    });
    expect(initiated).toEqual([]);
  });

  it('prices with a placeholder email and stays in progress until the payment is authorized', async () => {
    const initiated: unknown[] = [];
    const notReady = new Set<string>(['all']);
    const server = new ReactionaryACPServer(() => createTestClient({ initiated, notReady }), {
      sessionCache: new MemoryCache(),
      orderPermalinkUrl: 'https://shop.example/orders/{orderId}',
      paymentHandlers,
      paymentAuthorizationWait: { timeoutMs: 0 },
    });
    const address = {
      name: 'Ada Lovelace',
      line_one: '1 Computing Street',
      city: 'London',
      state: 'London',
      country: 'GB',
      postal_code: 'SW1A 1AA',
    };

    const created = await json<{ id: string; status: string }>(await server.fetch(
      jsonRequest('http://127.0.0.1/checkout_sessions', {
        line_items: [{ id: 'sku-1', quantity: 1 }],
        currency: 'eur',
        capabilities: agentCapabilities,
        fulfillment_details: { address },
      }),
    ));

    expect(created.status).toBe('not_ready_for_payment');
    expect(initiated).toEqual(['pending@checkout.invalid']);

    await server.fetch(
      jsonRequest(`http://127.0.0.1/checkout_sessions/${created.id}`, {
        ...selectStandardShipping,
      }),
    );

    const payload = {
      buyer: { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com' },
      payment_data: cardPayment('spt_test'),
    };
    const pending = await json<Record<string, unknown>>(await server.fetch(
      jsonRequest(`http://127.0.0.1/checkout_sessions/${created.id}/complete`, payload),
    ));

    expect(pending, JSON.stringify(pending)).toMatchObject({
      status: 'complete_in_progress',
      messages: [expect.objectContaining({ type: 'info' })],
    });
    expect(pending['order']).toBeUndefined();
    expect(initiated.at(-1)).toBe('ada@example.com');

    notReady.clear();
    const completed = await json<Record<string, unknown>>(await server.fetch(
      jsonRequest(`http://127.0.0.1/checkout_sessions/${created.id}/complete`, payload),
    ));
    const cancelCompleted = await server.fetch(jsonRequest(`http://127.0.0.1/checkout_sessions/${created.id}/cancel`, {}));

    expect(cancelCompleted.status).toBe(405);

    expect(completed).toMatchObject({
      status: 'completed',
      order: {
        type: 'order',
        id: 'order-1',
        checkout_session_id: created.id,
        permalink_url: 'https://shop.example/orders/order-1',
      },
    });
  });

  it('cancels a session whose payment is awaiting authorization', async () => {
    const notReady = new Set<string>(['all']);
    const server = new ReactionaryACPServer(() => createTestClient({ notReady }), {
      sessionCache: new MemoryCache(),
      paymentHandlers,
      paymentAuthorizationWait: { timeoutMs: 0 },
    });
    const created = await json<{ id: string }>(await server.fetch(jsonRequest('http://127.0.0.1/checkout_sessions', {
      line_items: [{ id: 'sku-1' }],
      currency: 'eur',
      capabilities: agentCapabilities,
      buyer: { email: 'ada@example.com' },
      fulfillment_details: fulfillmentDetails,
    })));
    const url = `http://127.0.0.1/checkout_sessions/${created.id}`;
    await server.fetch(jsonRequest(url, selectStandardShipping));

    const pending = await json<{ status: string }>(await server.fetch(
      jsonRequest(`${url}/complete`, { payment_data: cardPayment('spt_1') }),
    ));

    expect(pending.status).toBe('complete_in_progress');

    const canceled = await server.fetch(jsonRequest(`${url}/cancel`, {
      intent_trace: { reason_code: 'timing_deferred' },
    }));

    expect(canceled.status).toBe(200);
    await expect(canceled.json()).resolves.toMatchObject({
      status: 'canceled',
      messages: [{ type: 'info', content: 'Checkout session has been canceled.' }],
    });

    notReady.clear();
    const retried = await server.fetch(jsonRequest(`${url}/complete`, { payment_data: cardPayment('spt_1') }));

    expect(retried.status).toBe(405);
    await expect(json<{ status: string }>(await server.fetch(getRequest(url)))).resolves.toMatchObject({ status: 'canceled' });
  });

  it('sends signed order_create and order_update webhooks to the agent', async () => {
    const deliveries: Array<{ url: string; signature: string; body: string }> = [];
    const agentReceiver: typeof fetch = async (input, init) => {
      const request = new Request(input, init);
      deliveries.push({ url: request.url, signature: request.headers.get('merchant-signature') ?? '', body: await request.text() });
      return new Response(null, { status: 200 });
    };
    let orderStatus: Order['orderStatus'] = 'ReleasedToFulfillment';
    const server = new ReactionaryACPServer(() => createTestClient({ orderStatus }), {
      sessionCache: new MemoryCache(),
      paymentHandlers,
      authenticate: createBearerTokenAuthenticator({ chatgpt: 'token-a' }),
      orderPermalinkUrl: 'https://shop.example/orders/{orderId}',
      webhooks: {
        endpoints: [{ agentId: 'chatgpt', url: 'https://agent.example/agentic_checkout/webhooks/order_events', secret: 'whsec' }],
        fetch: agentReceiver,
      },
    });
    const authorized = (request: Request) => {
      request.headers.set('authorization', 'Bearer token-a');
      return server.fetch(request);
    };
    const created = await json<{ id: string }>(await authorized(jsonRequest('http://127.0.0.1/checkout_sessions', {
      line_items: [{ id: 'sku-1', quantity: 2 }],
      currency: 'eur',
      capabilities: agentCapabilities,
      buyer: { email: 'ada@example.com' },
      fulfillment_details: fulfillmentDetails,
    })));
    const url = `http://127.0.0.1/checkout_sessions/${created.id}`;
    await authorized(jsonRequest(url, selectStandardShipping));
    await authorized(jsonRequest(`${url}/complete`, { payment_data: cardPayment('spt_1') }));

    // A re-read of the completed session does not announce the order again.
    await authorized(getRequest(url));
    orderStatus = 'Shipped';

    await expect(server.notifyOrderUpdated('order-1')).resolves.toBe(true);
    await expect(server.notifyOrderUpdated('unknown-order')).resolves.toBe(false);
    await vi.waitFor(() => expect(deliveries).toHaveLength(2));

    expect(deliveries).toHaveLength(2);

    const [created_, updated] = deliveries.map((delivery) => {
      const match = /^t=(\d+),v1=([a-f0-9]{64})$/.exec(delivery.signature);
      expect(match, delivery.signature).toBeTruthy();
      expect(signWebhookPayload(delivery.body, 'whsec', Number(match?.[1]))).toBe(delivery.signature);
      expect(delivery.url).toBe('https://agent.example/agentic_checkout/webhooks/order_events');
      return JSON.parse(delivery.body) as { type: string; data: Record<string, unknown> };
    });

    expect(created_).toMatchObject({
      type: 'order_create',
      data: {
        type: 'order',
        id: 'order-1',
        checkout_session_id: created.id,
        permalink_url: 'https://shop.example/orders/order-1',
        status: 'confirmed',
        line_items: [{ id: 'line-1', quantity: { ordered: 2, current: 2, fulfilled: 0 }, unit_price: 1000, status: 'processing' }],
        fulfillments: [{ type: 'shipping', status: 'processing', carrier: 'Reactionary' }],
      },
    });
    expect(updated).toMatchObject({
      type: 'order_update',
      data: {
        status: 'shipped',
        line_items: [{ quantity: { fulfilled: 2 }, status: 'fulfilled' }],
        fulfillments: [{ status: 'shipped' }],
      },
    });
  });

  it('requires 3D Secure authentication before authorizing when asked to', async () => {
    const payments: Array<{ paymentInstruction: { protocolData: Array<{ key: string; value: string }> } }> = [];
    const metadata = {
      acquirer_details: {
        acquirer_bin: '123456',
        acquirer_country: 'US',
        acquirer_merchant_id: 'merchant_123',
        merchant_name: 'Example Store',
      },
      directory_server: 'visa' as const,
    };
    const server = new ReactionaryACPServer(() => createTestClient({ payments: payments as unknown[] }), {
      sessionCache: new MemoryCache(),
      paymentHandlers,
      paymentAuthorizationWait: { timeoutMs: 0 },
      interventions: { supported: ['3ds'] },
      authentication: { getMetadata: () => metadata },
    });
    const created = await json<{ id: string }>(await server.fetch(jsonRequest('http://127.0.0.1/checkout_sessions', {
      line_items: [{ id: 'sku-1' }],
      currency: 'eur',
      capabilities: { interventions: { supported: ['3ds'] } },
      buyer: { email: 'ada@example.com' },
      fulfillment_details: fulfillmentDetails,
    })));
    const url = `http://127.0.0.1/checkout_sessions/${created.id}`;
    const complete = (body: Record<string, unknown>) => server.fetch(jsonRequest(`${url}/complete`, {
      payment_data: cardPayment('spt_1'),
      ...body,
    }));
    await server.fetch(jsonRequest(url, selectStandardShipping));

    const required = await complete({});

    expect(required.status).toBe(200);
    await expect(required.json()).resolves.toMatchObject({ status: 'authentication_required', authentication_metadata: metadata });
    await expect(json<{ status: string }>(await server.fetch(getRequest(url)))).resolves.toMatchObject({
      status: 'authentication_required',
    });

    const missing = await complete({});

    expect(missing.status).toBe(400);
    await expect(missing.json()).resolves.toEqual({
      type: 'invalid_request',
      code: 'requires_3ds',
      message: "This checkout session requires issuer authentication. The request must include 'authentication_result'.",
      param: '$.authentication_result',
    });

    const denied = await json<Record<string, unknown>>(await complete({ authentication_result: { outcome: 'denied' } }));

    expect(denied).toMatchObject({
      status: 'authentication_required',
      messages: [expect.objectContaining({ code: 'payment_declined', param: '$.authentication_result' })],
    });
    expect(payments).toHaveLength(0);

    const outcomeDetails = {
      three_ds_cryptogram: 'AbCdEfGhIjKlMnOpQrStUvWxY0=',
      electronic_commerce_indicator: '05',
      transaction_id: 'dsTransId_abc123',
      version: '2.2.0',
    };
    const authenticated = await json<{ status: string }>(await complete({
      authentication_result: { outcome: 'authenticated', outcome_details: outcomeDetails },
    }));

    expect(authenticated.status).toBe('completed');
    expect(payments[0]?.paymentInstruction.protocolData).toContainEqual({
      key: 'acp_authentication_result',
      value: JSON.stringify({ outcome: 'authenticated', outcome_details: outcomeDetails }),
    });
  });

  it('applies discount codes when the agent declares the discount extension', async () => {
    const client = createTestClient({ couponCodes: ['SAVE10'] });
    const server = new ReactionaryACPServer(() => client, { sessionCache: new MemoryCache() });
    const create = (extensions: string[]) => server.fetch(jsonRequest('http://127.0.0.1/checkout_sessions', {
      line_items: [{ id: 'sku-1', quantity: 2 }],
      currency: 'eur',
      capabilities: { interventions: { supported: [] }, extensions },
      discounts: { codes: ['save10', 'BOGUS'] },
    }));

    const created = await json<Record<string, unknown> & { id: string }>(await create(['discount']));

    expect(created['capabilities']).toMatchObject({ extensions: [{ name: 'discount', extends: expect.arrayContaining(['$.CheckoutSession.discounts']) }] });
    expect(created['discounts']).toEqual({
      codes: ['save10', 'BOGUS'],
      applied: [{
        id: 'discount_1',
        code: 'SAVE10',
        coupon: { id: 'SAVE10', name: '10% off', amount_off: 200, currency: 'eur' },
        amount: 200,
        automatic: false,
        method: 'each',
        allocations: [{ path: '$.line_items[0]', amount: 200 }],
      }],
      rejected: [{ code: 'BOGUS', reason: 'discount_code_invalid', message: "Discount code 'BOGUS' could not be applied." }],
    });
    expect(created['messages']).toContainEqual(expect.objectContaining({
      type: 'warning',
      code: 'discount_code_invalid',
      param: '$.discounts.codes[1]',
    }));

    const cleared = await json<Record<string, unknown>>(await server.fetch(
      jsonRequest(`http://127.0.0.1/checkout_sessions/${created.id}`, { discounts: { codes: [] } }),
    ));

    expect(cleared['discounts']).toEqual({ codes: [], applied: [], rejected: [] });

    const undeclared = await json<Record<string, unknown>>(await create([]));

    expect(undeclared['discounts']).toBeUndefined();
    expect(undeclared['capabilities']).not.toHaveProperty('extensions');

    const discovery = await json<{ capabilities: Record<string, unknown> }>(
      await server.fetch(new Request('https://shop.example.com/.well-known/acp.json')),
    );

    expect(discovery.capabilities['extensions']).toEqual([{ name: 'discount' }]);
  });

  it('reports first- and last-touch affiliate attribution with the order', async () => {
    const attributions: unknown[] = [];
    const server = new ReactionaryACPServer(() => createTestClient(), {
      sessionCache: new MemoryCache(),
      paymentHandlers,
      paymentAuthorizationWait: { timeoutMs: 0 },
      onOrderAttribution: (attribution) => {
        attributions.push(attribution);
      },
    });
    const firstTouch = { provider: 'impact.com', token: 'atp_first', publisher_id: 'pub_123', touchpoint: 'first' };
    const created = await server.fetch(jsonRequest('http://127.0.0.1/checkout_sessions', {
      line_items: [{ id: 'sku-1' }],
      currency: 'eur',
      capabilities: agentCapabilities,
      buyer: { email: 'ada@example.com' },
      fulfillment_details: fulfillmentDetails,
      affiliate_attribution: firstTouch,
    }));
    const createdBody = await created.text();
    const { id } = JSON.parse(createdBody) as { id: string };
    const url = `http://127.0.0.1/checkout_sessions/${id}`;

    expect(createdBody).not.toContain('atp_first');

    await server.fetch(jsonRequest(url, selectStandardShipping));
    const completed = await server.fetch(jsonRequest(`${url}/complete`, {
      payment_data: cardPayment('spt_1'),
      affiliate_attribution: { provider: 'impact.com', publisher_id: 'pub_456', campaign_id: 'camp_1' },
    }));

    expect(await completed.text()).not.toContain('pub_456');
    expect(attributions).toEqual([{
      orderId: 'order-1',
      checkoutSessionId: id,
      firstTouch,
      lastTouch: { provider: 'impact.com', publisher_id: 'pub_456', campaign_id: 'camp_1', touchpoint: 'last' },
    }]);

    const invalid = await server.fetch(jsonRequest('http://127.0.0.1/checkout_sessions', {
      line_items: [{ id: 'sku-1' }],
      currency: 'eur',
      capabilities: agentCapabilities,
      affiliate_attribution: { provider: 'impact.com' },
    }));

    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toMatchObject({ param: '$.affiliate_attribution.token' });
  });

  it('offers marketing consent and reports the buyer decisions with the order', async () => {
    const recorded: unknown[] = [];
    const server = new ReactionaryACPServer(() => createTestClient(), {
      sessionCache: new MemoryCache(),
      paymentHandlers,
      paymentAuthorizationWait: { timeoutMs: 0 },
      marketingConsent: {
        channels: [
          { channel: 'email', display_text: 'Product news and offers', privacy_policy_url: 'https://shop.example/privacy' },
          { channel: 'sms', display_text: 'Order deals by text', privacy_policy_url: 'https://shop.example/privacy' },
        ],
        isSubscribed: (contact, channel) => contact === 'ada@example.com' && channel === 'email',
        onConsents: (consents, context) => {
          recorded.push({ consents, context });
        },
      },
    });
    const created = await json<Record<string, unknown> & { id: string }>(await server.fetch(jsonRequest('http://127.0.0.1/checkout_sessions', {
      line_items: [{ id: 'sku-1' }],
      currency: 'eur',
      capabilities: agentCapabilities,
      buyer: { email: 'ada@example.com' },
      fulfillment_details: fulfillmentDetails,
    })));
    const url = `http://127.0.0.1/checkout_sessions/${created.id}`;

    expect(created['marketing_consent_options']).toEqual([
      { channel: 'email', display_text: 'Product news and offers', privacy_policy_url: 'https://shop.example/privacy', is_subscribed: true },
      { channel: 'sms', display_text: 'Order deals by text', privacy_policy_url: 'https://shop.example/privacy', is_subscribed: false },
    ]);

    await server.fetch(jsonRequest(url, selectStandardShipping));
    await server.fetch(jsonRequest(`${url}/complete`, {
      payment_data: cardPayment('spt_1'),
      // sms has no phone to apply to, and push was never offered.
      marketing_consents: [
        { channel: 'email', opted_in: false },
        { channel: 'sms', opted_in: true },
        { channel: 'push', opted_in: true },
      ],
    }));

    expect(recorded).toEqual([{
      consents: [{ channel: 'email', opted_in: false, contact: 'ada@example.com' }],
      context: { orderId: 'order-1', checkoutSessionId: created.id },
    }]);
  });

  it('manages pre-checkout carts', async () => {
    const client = createTestClient({ inPlaceCartUpdates: true });
    const server = new ReactionaryACPServer(() => client, {
      sessionCache: new MemoryCache(),
      authenticate: createBearerTokenAuthenticator({ chatgpt: 'token-a', other: 'token-b' }),
    });
    const send = (method: string, path: string, body?: unknown, token = 'token-a') => server.fetch(new Request(`http://127.0.0.1${path}`, {
      method,
      headers: {
        'api-version': '2026-04-17',
        authorization: `Bearer ${token}`,
        ...(method === 'POST' ? { 'idempotency-key': crypto.randomUUID() } : {}),
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }));

    const createdResponse = await send('POST', '/carts', {
      line_items: [{ id: 'sku-1', quantity: 2 }],
      buyer: { email: 'ada@example.com' },
    });
    const created = await json<Record<string, unknown> & { id: string }>(createdResponse);

    expect(createdResponse.status).toBe(201);
    expect(created).toMatchObject({
      id: expect.stringMatching(/^cart_/),
      line_items: [{ item: { id: 'sku-1' }, quantity: 2, name: 'Test variant' }],
      buyer: { email: 'ada@example.com' },
      currency: 'eur',
      totals: expect.arrayContaining([{ type: 'total', display_text: 'Total', amount: 2000 }]),
      messages: [],
      expires_at: expect.any(String),
    });

    const replaced = await json<{ line_items: Array<{ item: { id: string }; quantity: number }> }>(
      await send('PUT', `/carts/${created.id}`, { line_items: [{ id: 'sku-2', quantity: 1 }] }),
    );

    expect(replaced.line_items.map((lineItem) => [lineItem.item.id, lineItem.quantity])).toEqual([['sku-2', 1]]);
    expect((await send('GET', `/carts/${created.id}`, undefined, 'token-b')).status).toBe(404);

    const canceled = await send('POST', `/carts/${created.id}/cancel`);

    expect(canceled.status).toBe(200);
    await expect(canceled.json()).resolves.toMatchObject({ id: created.id });
    expect((await send('GET', `/carts/${created.id}`)).status).toBe(404);
    expect((await send('POST', '/carts', { line_items: [] })).status).toBe(400);
  });

  it('records intent traces on cancel without returning them', async () => {
    const traces: unknown[] = [];
    const server = new ReactionaryACPServer(() => createTestClient(), {
      sessionCache: new MemoryCache(),
      onIntentTrace: (trace, context) => {
        traces.push({ trace, context });
      },
    });
    const create = async () => (await json<{ id: string }>(await server.fetch(jsonRequest('http://127.0.0.1/checkout_sessions', {
      line_items: [{ id: 'sku-1' }],
      currency: 'eur',
      capabilities: agentCapabilities,
    })))).id;

    const first = await create();
    const canceled = await server.fetch(jsonRequest(`http://127.0.0.1/checkout_sessions/${first}/cancel`, {
      intent_trace: {
        reason_code: 'shipping_cost',
        trace_summary: 'Shipping was more than the buyer wanted to pay.',
        metadata: { target_shipping_cost: 0, competitor_reference: 'elsewhere' },
      },
    }));
    const canceledBody = await canceled.text();

    expect(canceled.status).toBe(200);
    expect(JSON.parse(canceledBody)).toMatchObject({ status: 'canceled' });
    expect(canceledBody).not.toContain('intent_trace');
    expect(await (await server.fetch(getRequest(`http://127.0.0.1/checkout_sessions/${first}`))).text()).not.toContain('shipping_cost');
    expect(traces).toEqual([{
      trace: {
        reason_code: 'shipping_cost',
        trace_summary: 'Shipping was more than the buyer wanted to pay.',
        metadata: { target_shipping_cost: 0, competitor_reference: 'elsewhere' },
      },
      context: { checkoutSessionId: first },
    }]);

    const unknownReason = await server.fetch(jsonRequest(`http://127.0.0.1/checkout_sessions/${await create()}/cancel`, {
      intent_trace: { reason_code: 'gift_card_only' },
    }));

    expect(unknownReason.status).toBe(200);
    expect(traces.at(-1)).toMatchObject({ trace: { reason_code: 'other' } });

    const nested = await server.fetch(jsonRequest(`http://127.0.0.1/checkout_sessions/${await create()}/cancel`, {
      intent_trace: { reason_code: 'other', metadata: { nested: { not: 'allowed' } } },
    }));

    expect(nested.status).toBe(400);

    const noBody = new Request(`http://127.0.0.1/checkout_sessions/${await create()}/cancel`, {
      method: 'POST',
      headers: { 'api-version': '2026-04-17', 'idempotency-key': crypto.randomUUID() },
    });

    expect((await server.fetch(noBody)).status).toBe(200);
  });

  it('waits for an asynchronous payment authorization before answering', async () => {
    const notReady = new Set<string>(['all']);
    const server = new ReactionaryACPServer(() => createTestClient({ notReady }), {
      sessionCache: new MemoryCache(),
      paymentHandlers,
      paymentAuthorizationWait: { timeoutMs: 2_000, intervalMs: 10 },
    });
    const created = await json<{ id: string }>(await server.fetch(
      jsonRequest('http://127.0.0.1/checkout_sessions', {
        line_items: [{ id: 'sku-1', quantity: 1 }],
        currency: 'eur',
        capabilities: agentCapabilities,
        fulfillment_details: fulfillmentDetails,
      }),
    ));
    await server.fetch(
      jsonRequest(`http://127.0.0.1/checkout_sessions/${created.id}`, selectStandardShipping),
    );

    // The PSP webhook records the authorization while completion is waiting.
    setTimeout(() => notReady.clear(), 50);

    const completed = await json<Record<string, unknown>>(await server.fetch(
      jsonRequest(`http://127.0.0.1/checkout_sessions/${created.id}/complete`, {
        buyer: { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com' },
        payment_data: cardPayment('spt_test'),
      }),
    ));

    expect(completed).toMatchObject({ status: 'completed' });
  });

  it('passes the delegated token verbatim and reports declines', async () => {
    const payments: unknown[] = [];
    const createServer = (declinePayments: boolean) => new ReactionaryACPServer(
      () => createTestClient({ payments, declinePayments }),
      { sessionCache: new MemoryCache(),
      paymentHandlers, paymentAuthorizationWait: { timeoutMs: 0 } },
    );
    const openSession = async (server: ReactionaryACPServer) => {
      const created = await json<{ id: string }>(await server.fetch(
        jsonRequest('http://127.0.0.1/checkout_sessions', {
          line_items: [{ id: 'sku-1', quantity: 1 }],
        currency: 'eur',
        capabilities: agentCapabilities,
          buyer: { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com' },
          fulfillment_details: fulfillmentDetails,
        }),
      ));
      await server.fetch(jsonRequest(`http://127.0.0.1/checkout_sessions/${created.id}`, selectStandardShipping));
      return created.id;
    };
    const complete = { payment_data: cardPayment('spt_123') };

    const server = createServer(false);
    await server.fetch(jsonRequest(`http://127.0.0.1/checkout_sessions/${await openSession(server)}/complete`, complete));

    expect(payments[0]).toMatchObject({
      paymentInstruction: {
        protocolData: [
          { key: 'delegated_payment_token', value: 'spt_123' },
          { key: 'delegated_payment_provider', value: 'stripe' },
          { key: 'acp_payment_handler_id', value: 'card_tokenized' },
          { key: 'acp_payment_instrument_type', value: 'card' },
          { key: 'acp_payment_credential_type', value: 'spt' },
        ],
        paymentMethod: { method: 'card', name: 'stripe', paymentProcessor: 'stripe' },
      },
    });

    const declining = createServer(true);
    const declined = await declining.fetch(
      jsonRequest(`http://127.0.0.1/checkout_sessions/${await openSession(declining)}/complete`, complete),
    );

    expect(declined.status).toBe(200);
    await expect(declined.json()).resolves.toMatchObject({
      status: 'ready_for_payment',
      messages: [{ type: 'error', code: 'payment_declined', param: '$.payment_data' }],
    });
  });

  it('publishes feed products to the agent-hosted Feed API in batches', async () => {
    const requests: Array<{ method: string; url: string; headers: Headers; body: unknown }> = [];
    const observedLanguageContexts: RequestContext['languageContext'][] = [];
    const fakeAgent: typeof fetch = async (input, init) => {
      const request = new Request(input, init);
      const body: unknown = request.method === 'GET' ? undefined : await request.json();
      requests.push({ method: request.method, url: request.url, headers: request.headers, body });

      return request.method === 'POST'
        ? Response.json({ id: 'feed_123', target_country: 'FI' }, { status: 201 })
        : Response.json({ id: 'feed_123', accepted: true });
    };
    const publisher = new ReactionaryACPFeedPublisher((requestContext) => {
      observedLanguageContexts.push({ ...requestContext.languageContext });
      return createTestClient();
    }, {
      feedApiBaseUrl: 'https://agent.example/api/',
      apiKey: 'merchant-key',
      fetch: fakeAgent,
      batchSize: 1,
      feeds: {
        finnish: {
          languageContext: { locale: 'fi-FI', currencyCode: 'EUR' },
          search: { term: 'shoes', facets: [], filters: [], paginationOptions: { pageNumber: 1, pageSize: 25 } },
          productUrlBase: 'https://shop.example/{lang}/products/{slug}',
        },
      },
    });

    const metadata = await publisher.createFeed('finnish');
    const result = await publisher.publish('finnish', metadata.id);

    expect(metadata).toEqual({ id: 'feed_123', target_country: 'FI' });
    expect(result).toEqual({ feedId: 'feed_123', products: 1, batches: 1 });
    expect(observedLanguageContexts[0]).toEqual({ locale: 'fi-FI', currencyCode: 'EUR' });
    expect(requests.map((request) => `${request.method} ${request.url}`)).toEqual([
      'POST https://agent.example/api/feeds',
      'PATCH https://agent.example/api/feeds/feed_123/products',
    ]);
    expect(requests[0]?.body).toEqual({ target_country: 'FI' });
    expect(requests[1]?.headers.get('authorization')).toBe('Bearer merchant-key');
    expect(requests[1]?.headers.get('api-version')).toBe('2026-04-17');
    expect(requests[1]?.headers.get('idempotency-key')).toBeTruthy();
    expect(requests[1]?.body).toMatchObject({
      products: [{
        id: 'product-1',
        url: 'https://shop.example/fi/products/test-product',
        variants: [{
          id: 'sku-1',
          availability: { available: true, status: 'in_stock' },
          price: { amount: 800, currency: 'EUR' },
          list_price: { amount: 1000, currency: 'EUR' },
        }],
      }],
    });
  });

  it('no longer serves a merchant-hosted product feed', async () => {
    const server = new ReactionaryACPServer(() => createTestClient());
    const response = await server.fetch(new Request('http://127.0.0.1/product_feeds/finnish/products'));
    const readiness = await json<{ actions: string[] }>(await server.fetch(new Request('http://127.0.0.1/acp')));

    expect(await response.json()).not.toHaveProperty('products');
    expect(readiness.actions).not.toContain('GET /product_feeds/{id}/products');
  });
});

function createTestClient(options: {
  observedSearches?: unknown[];
  initiated?: unknown[];
  notReady?: Set<string>;
  payments?: unknown[];
  declinePayments?: boolean;
  currency?: Currency;
  unknownSkus?: string[];
  noShippingMethods?: boolean;
  cartCalls?: string[];
  inPlaceCartUpdates?: boolean;
  orderStatus?: Order['orderStatus'];
  couponCodes?: string[];
  failCartCreation?: boolean;
} = {}): ReactionaryACPClient & ReactionaryFeedClient {
  const withReadiness = (checkout: Checkout): Checkout => ({
    ...checkout,
    readyForFinalization: !options.notReady?.has('all'),
  });
  let cartCounter = 0;
  let checkoutCounter = 0;
  const carts = new Map<string, Cart>();
  const checkouts = new Map<string, Checkout>();

  return {
    cart: {
      async createCart() {
        options.cartCalls?.push('createCart');
        if (options.failCartCreation) {
          return error<GenericError>({ type: 'Generic', message: 'database credentials expired for tenant 42' });
        }
        cartCounter += 1;
        const cart = createCart(`cart-${cartCounter}`, [], options.currency);
        carts.set(cart.identifier.key, cart);
        return success(cart);
      },
      async add(payload) {
        const addPayload = payload as {
          cart: { key: string };
          variant: { sku: string };
          quantity: number;
        };
        if (options.unknownSkus?.includes(addPayload.variant.sku)) {
          return error<NotFoundError>({ type: 'NotFound', identifier: addPayload.variant });
        }
        const cart = carts.get(addPayload.cart.key) ?? createCart(
          addPayload.cart.key,
          [],
          options.currency,
        );
        const updated = createCart(cart.identifier.key, [
          ...cart.items.map((item) => ({
            sku: item.variant.sku,
            quantity: item.quantity,
          })),
          {
            sku: addPayload.variant.sku,
            quantity: addPayload.quantity,
          },
        ], options.currency);
        carts.set(updated.identifier.key, updated);
        return success(updated);
      },
      async getById(payload) {
        const getPayload = payload as { cart: { key: string } };
        return success(carts.get(getPayload.cart.key) ?? createCart('missing', [], options.currency));
      },
      async deleteCart(payload) {
        const deletePayload = payload as { cart: { key: string } };
        options.cartCalls?.push(`deleteCart:${deletePayload.cart.key}`);
        carts.delete(deletePayload.cart.key);
        return success(undefined);
      },
      ...(options.couponCodes
        ? {
            async applyCouponCode(payload: unknown) {
              const coupon = payload as { cart: { key: string }; couponCode: string };
              const cart = carts.get(coupon.cart.key);
              if (!cart || !options.couponCodes?.includes(coupon.couponCode)) {
                return error<GenericError>({ type: 'Generic', message: 'unknown code' });
              }
              const discounted = withCoupon(cart, coupon.couponCode);
              carts.set(discounted.identifier.key, discounted);
              return success(discounted);
            },
            async removeCouponCode(payload: unknown) {
              const coupon = payload as { cart: { key: string } };
              const cart = carts.get(coupon.cart.key) ?? createCart(coupon.cart.key, [], options.currency);
              const plain = createCart(cart.identifier.key, cart.items.map((item) => ({
                sku: item.variant.sku,
                quantity: item.quantity,
              })), options.currency);
              carts.set(plain.identifier.key, plain);
              return success(plain);
            },
          }
        : {}),
      ...(options.inPlaceCartUpdates
        ? {
            async changeQuantity(payload: unknown) {
              const change = payload as { cart: { key: string }; item: { key: string }; quantity: number };
              options.cartCalls?.push(`changeQuantity:${change.item.key}:${change.quantity}`);
              const cart = carts.get(change.cart.key) ?? createCart(change.cart.key, [], options.currency);
              const updated = createCart(cart.identifier.key, cart.items.map((item) => ({
                sku: item.variant.sku,
                quantity: item.identifier.key === change.item.key ? change.quantity : item.quantity,
              })), options.currency);
              carts.set(updated.identifier.key, updated);
              return success(updated);
            },
            async remove(payload: unknown) {
              const removal = payload as { cart: { key: string }; item: { key: string } };
              options.cartCalls?.push(`remove:${removal.item.key}`);
              const cart = carts.get(removal.cart.key) ?? createCart(removal.cart.key, [], options.currency);
              const updated = createCart(cart.identifier.key, cart.items
                .filter((item) => item.identifier.key !== removal.item.key)
                .map((item) => ({ sku: item.variant.sku, quantity: item.quantity })), options.currency);
              carts.set(updated.identifier.key, updated);
              return success(updated);
            },
          }
        : {}),
    },
    checkout: {
      async initiateCheckoutForCart(payload) {
        checkoutCounter += 1;
        const initPayload = payload as { cart: Cart; notificationEmail?: string };
        options.initiated?.push(initPayload.notificationEmail);
        const checkout = createCheckout(
          `checkout-${checkoutCounter}`,
          initPayload.cart,
        );
        checkouts.set(checkout.identifier.key, checkout);
        return success(checkout);
      },
      async getById(payload) {
        const getPayload = payload as { identifier: { key: string } };
        return success(withReadiness(
          checkouts.get(getPayload.identifier.key) ??
            createCheckout('missing', createCart('missing', [], options.currency)),
        ));
      },
      async setShippingAddress(payload) {
        const checkout = getCheckoutFromPayload(checkouts, payload);
        return success(checkout);
      },
      async getAvailableShippingMethods() {
        if (options.noShippingMethods) {
          return success([]);
        }
        return success([
          {
            identifier: { key: 'standard' },
            name: 'Standard shipping',
            description: 'Ships soon',
            price: { value: 5, currency: 'EUR' },
            deliveryTime: '3-5 business days',
            carrier: 'Reactionary',
          },
        ]);
      },
      async getAvailablePaymentMethods() {
        return success([
          {
            identifier: {
              method: 'card',
              name: 'Stripe',
              paymentProcessor: 'stripe',
            },
            description: 'Stripe card payment',
            isPunchOut: false,
          },
        ]);
      },
      async setShippingInstruction(payload) {
        const checkout = getCheckoutFromPayload(checkouts, payload);
        return success(checkout);
      },
      async addPaymentInstruction(payload) {
        options.payments?.push(payload);
        if (options.declinePayments) {
          return error<GenericError>({ type: 'Generic', message: 'card declined' });
        }
        const checkout = getCheckoutFromPayload(checkouts, payload);
        return success(checkout);
      },
      async finalizeCheckout(payload) {
        const checkout = getCheckoutFromPayload(checkouts, payload);
        const finalized = {
          ...checkout,
          resultingOrder: { key: 'order-1' },
        };
        checkouts.set(finalized.identifier.key, finalized);
        return success(finalized);
      },
    },
    order: {
      async getById(payload) {
        const orderPayload = payload as { order: { key: string } };
        return success(createOrder(orderPayload.order.key, options.orderStatus ?? 'ReleasedToFulfillment'));
      },
    },
    productSearch: {
      async queryByTerm(payload) {
        options.observedSearches?.push((payload as { search: unknown }).search);
        return success(createProductSearchResult());
      },
    },
    product: {
      async getBySKU() {
        return success(createProduct());
      },
    },
    price: {
      async getListPrice() {
        return success(createPrice(10));
      },
      async getCustomerPrice() {
        return success(createPrice(8));
      },
    },
    inventory: {
      async getBySKU() {
        return success(createInventory());
      },
    },
  };
}

function createCart(
  id: string,
  items: Array<{ sku: string; quantity: number }>,
  currency: Currency = 'EUR',
): Cart {
  const total = items.reduce((sum, item) => sum + item.quantity * 10, 0);

  return {
    identifier: { key: id },
    user: { userId: '' },
    name: '',
    items: items.map((item, index) => ({
      identifier: { key: `line-${index + 1}` },
      product: { key: item.sku },
      variant: { sku: item.sku },
      quantity: item.quantity,
      price: {
        unitPrice: { value: 10, currency },
        unitDiscount: { value: 0, currency },
        totalPrice: { value: item.quantity * 10, currency },
        totalDiscount: { value: 0, currency },
      },
    })),
    price: {
      totalTax: { value: 0, currency },
      totalDiscount: { value: 0, currency },
      totalSurcharge: { value: 0, currency },
      totalShipping: { value: 0, currency },
      totalProductPrice: { value: total, currency },
      grandTotal: { value: total, currency },
    },
    appliedPromotions: [],
    description: '',
  };
}

/** A cart with a 10% line discount from a coupon. */
function withCoupon(cart: Cart, code: string): Cart {
  const items = cart.items.map((item) => ({
    ...item,
    price: {
      ...item.price,
      totalDiscount: { value: item.price.totalPrice.value * 0.1, currency: item.price.totalPrice.currency },
      totalPrice: { value: item.price.totalPrice.value * 0.9, currency: item.price.totalPrice.currency },
    },
  }));
  const discount = items.reduce((sum, item) => sum + item.price.totalDiscount.value, 0);

  return {
    ...cart,
    items,
    price: {
      ...cart.price,
      totalDiscount: { value: discount, currency: cart.price.grandTotal.currency },
      grandTotal: { value: cart.price.grandTotal.value - discount, currency: cart.price.grandTotal.currency },
    },
    appliedPromotions: [{ code, isCouponCode: true, name: '10% off', description: '' }],
  };
}

function createOrder(id: string, orderStatus: Order['orderStatus']): Order {
  const cart = createCart('cart-1', [{ sku: 'sku-1', quantity: 2 }]);

  return {
    identifier: { key: id },
    userId: { userId: '' },
    items: cart.items.map((item) => ({
      identifier: item.identifier,
      variant: item.variant,
      quantity: item.quantity,
      price: item.price,
      inventoryStatus: 'Allocated',
    })),
    price: cart.price,
    shippingMethod: {
      identifier: { key: 'standard' },
      name: 'Standard shipping',
      description: '',
      price: { value: 5, currency: 'EUR' },
      deliveryTime: '',
      carrier: 'Reactionary',
    },
    orderStatus,
    inventoryStatus: 'Allocated',
    paymentInstructions: [],
  };
}

function createCheckout(id: string, cart: Cart): Checkout {
  return {
    identifier: { key: id },
    originalCartReference: cart.identifier,
    items: cart.items.map((item) => ({
      identifier: { key: item.identifier.key },
      variant: item.variant,
      quantity: item.quantity,
      price: item.price,
    })),
    price: cart.price,
    name: '',
    description: '',
    pointOfContact: {
      email: 'ada@example.com',
    },
    billingAddress: null,
    paymentInstructions: [],
    readyForFinalization: true,
  };
}

function createProductSearchResult(): ProductSearchResult {
  return {
    identifier: {
      term: '',
      facets: [],
      filters: [],
      paginationOptions: {
        pageNumber: 1,
        pageSize: 50,
      },
    },
    pageNumber: 1,
    pageSize: 50,
    totalCount: 1,
    totalPages: 1,
    facets: [],
    items: [
      {
        identifier: { key: 'product-1' },
        name: 'Test product',
        slug: 'test-product',
        variants: [
          {
            variant: { sku: 'sku-1' },
            image: {
              sourceUrl: 'https://cdn.example/sku-1.png',
              altText: 'Test variant',
            },
          },
        ],
      },
    ],
  };
}

function createProduct(): Product {
  return {
    identifier: { key: 'product-1' },
    name: 'Test product',
    slug: 'test-product',
    description: 'Short description',
    longDescription: 'Long description',
    brand: 'Reactionary',
    manufacturer: 'Reactionary',
    parentCategories: [],
    published: true,
    sharedAttributes: [],
    options: [],
    mainVariant: {
      identifier: { sku: 'sku-1' },
      name: 'Test variant',
      images: [
        {
          sourceUrl: 'https://cdn.example/sku-1.png',
          altText: 'Test variant',
        },
      ],
      ean: '',
      gtin: '',
      upc: '',
      barcode: '',
      options: [],
    },
    variants: [],
  };
}

function createPrice(value: number): Price {
  return {
    identifier: {
      variant: { sku: 'sku-1' },
    },
    unitPrice: {
      value,
      currency: 'EUR',
    },
    onSale: false,
    tieredPrices: [],
  };
}

function createInventory(): Inventory {
  return {
    identifier: {
      variant: { sku: 'sku-1' },
      fulfillmentCenter: { key: '' },
    },
    quantity: 5,
    status: 'inStock',
  };
}

function getCheckoutFromPayload(
  checkouts: Map<string, Checkout>,
  payload: unknown,
): Checkout {
  const checkoutPayload = payload as { checkout: { key: string } };
  return (
    checkouts.get(checkoutPayload.checkout.key) ??
    createCheckout('missing', createCart('missing', []))
  );
}

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'api-version': '2026-04-17',
      'idempotency-key': crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  });
}

function getRequest(url: string): Request {
  return new Request(url, {
    headers: {
      'api-version': '2026-04-17',
    },
  });
}

async function json<T>(response: Response): Promise<T> {
  return await response.json() as T;
}
