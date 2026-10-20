import type { RequestContext } from '@reactionary/core';
import { createInitialRequestContext } from '@reactionary/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MagentoClient, RequestContextTokenStore } from '../core/client.js';
import { MagentoApiError } from '../core/errors.js';
import { MagentoConfigurationSchema } from '../schema/configuration.schema.js';

const config = MagentoConfigurationSchema.parse({
  adminApiKey: 'admin-token',
  baseUrl: 'https://shop.example.com',
  allCurrencies: ['EUR'],
  storeBaseCode: 'b2c',
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;
let context: RequestContext;

beforeEach(() => {
  fetchMock = vi.fn().mockImplementation(async () => jsonResponse({}));
  vi.stubGlobal('fetch', fetchMock);
  context = createInitialRequestContext();
  context.languageContext.locale = 'en-US';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function headersOfCall(index: number): Record<string, string> {
  const init = fetchMock.mock.calls.at(index)?.[1];
  const headers: Record<string, string> = init?.headers ?? {};
  return headers;
}

function lastAuthorization(): string | undefined {
  return headersOfCall(-1)['Authorization'];
}

async function signIn(token = 'customer-token') {
  await new RequestContextTokenStore(context).setItem('customerToken', token);
}

describe('MagentoClient credential scoping', () => {
  describe('for an anonymous shopper', () => {
    it('sends no Authorization header on storefront REST calls', async () => {
      const client = new MagentoClient(config, context);

      await client.getCart('masked-cart');
      expect(lastAuthorization()).toBeUndefined();

      await client.getPaymentMethods('masked-cart');
      expect(lastAuthorization()).toBeUndefined();

      await client.storefrontRequest('GET', '/V1/directory/countries');
      expect(lastAuthorization()).toBeUndefined();
    });

    it('sends no Authorization header on customer-account calls', async () => {
      const client = new MagentoClient(config, context);

      await client.register({ email: 'a@example.com', firstname: 'A', lastname: 'B' }, 'secret');
      expect(lastAuthorization()).toBeUndefined();

      await client.accountRequest('GET', '/V1/customers/me').catch(() => undefined);
      expect(lastAuthorization()).toBeUndefined();
    });

    it('sends no Authorization header on GraphQL calls', async () => {
      fetchMock.mockImplementation(async () => jsonResponse({ data: { products: { items: [] } } }));
      const client = new MagentoClient(config, context);

      await client.getProductReviews('SKU-1', 10, 1);
      expect(lastAuthorization()).toBeUndefined();

      await client.graphqlRequest('{ customer { email } }');
      expect(lastAuthorization()).toBeUndefined();
    });

    it('uses the integration token for catalog reads', async () => {
      fetchMock.mockImplementation(async () => jsonResponse({ items: [], total_count: 0 }));
      const client = new MagentoClient(config, context);
      const api = await client.getClient();

      await client.getProductBySKU('SKU-1');
      expect(lastAuthorization()).toBe('Bearer admin-token');

      await client.searchProductsByAttribute('url_key', 'shoe');
      expect(lastAuthorization()).toBe('Bearer admin-token');

      await api.store.category.list(new URLSearchParams());
      expect(lastAuthorization()).toBe('Bearer admin-token');

      await api.store.inventory.getStockStatus('SKU-1');
      expect(lastAuthorization()).toBe('Bearer admin-token');

      await client.getConfigurableChildren('SKU-1');
      expect(lastAuthorization()).toBe('Bearer admin-token');

      await client.catalogRequest('/V1/products/attributes/color');
      expect(lastAuthorization()).toBe('Bearer admin-token');
    });

    it('issues catalog requests as GET only', async () => {
      const client = new MagentoClient(config, context);

      await client.catalogRequest('/V1/products/SKU-1');

      expect(fetchMock.mock.calls.at(-1)?.[1]?.method).toBe('GET');
    });

    it('builds the attribute search against the store view', async () => {
      fetchMock.mockImplementation(async () => jsonResponse({ items: [], total_count: 0 }));
      const client = new MagentoClient(config, context);

      await client.searchProductsByAttribute('external_id', 'P-1');

      const url = new URL(String(fetchMock.mock.calls.at(-1)?.[0]));
      expect(url.pathname).toBe('/rest/b2c-en/V1/products');
      expect(url.searchParams.get('searchCriteria[filterGroups][0][filters][0][field]')).toBe('external_id');
      expect(url.searchParams.get('searchCriteria[filterGroups][0][filters][0][value]')).toBe('P-1');
      expect(url.searchParams.get('searchCriteria[pageSize]')).toBe('1');
    });
  });

  describe('for a signed-in customer', () => {
    it('sends the customer token on storefront, account and GraphQL calls', async () => {
      await signIn();
      const client = new MagentoClient(config, context);

      await client.getCart(null);
      expect(lastAuthorization()).toBe('Bearer customer-token');

      await client.getMe();
      expect(lastAuthorization()).toBe('Bearer customer-token');

      fetchMock.mockImplementation(async () => jsonResponse({ data: {} }));
      await client.graphqlRequest('{ customer { email } }');
      expect(lastAuthorization()).toBe('Bearer customer-token');
    });

    it('still reads the catalog with the integration token', async () => {
      await signIn();
      const client = new MagentoClient(config, context);

      await client.getProductBySKU('SKU-1');

      expect(lastAuthorization()).toBe('Bearer admin-token');
    });
  });

  it('keeps admin calls on the integration token', async () => {
    await signIn();
    fetchMock.mockImplementation(async () => jsonResponse({ entity_id: 5 }));
    const client = new MagentoClient(config, context);

    await client.getOrderById('5');
    expect(lastAuthorization()).toBe('Bearer admin-token');

    await client.adminRequest('GET', '/V1/company/1');
    expect(lastAuthorization()).toBe('Bearer admin-token');
  });
});

describe('MagentoClient.graphqlRequest headers', () => {
  beforeEach(() => {
    fetchMock.mockImplementation(async () => jsonResponse({ data: { company: null } }));
  });

  it('sends extra headers such as X-Adobe-Company after the auth and store headers', async () => {
    await signIn();
    const client = new MagentoClient(config, context);

    await client.graphqlRequest('{ company { id } }', undefined, {
      headers: { 'X-Adobe-Company': 'Mw==' },
    });

    expect(headersOfCall(-1)).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer customer-token',
      Store: 'b2c-en',
      'X-Adobe-Company': 'Mw==',
    });
  });

  it('never lets a caller replace the credentials or the content type', async () => {
    await signIn();
    const client = new MagentoClient(config, context);

    await client.graphqlRequest('{ company { id } }', undefined, {
      headers: {
        Authorization: 'Bearer forged',
        authorization: 'Bearer forged',
        'CONTENT-TYPE': 'text/plain',
        'X-Adobe-Company': 'Mw==',
      },
    });

    const headers = headersOfCall(-1);
    expect(headers['Authorization']).toBe('Bearer customer-token');
    expect(headers['Content-Type']).toBe('application/json');
    expect(Object.keys(headers).filter((name) => name.toLowerCase() === 'authorization')).toEqual(['Authorization']);
    expect(Object.keys(headers).filter((name) => name.toLowerCase() === 'content-type')).toEqual(['Content-Type']);
  });

  it('adds no Authorization header for an anonymous shopper', async () => {
    const client = new MagentoClient(config, context);

    await client.graphqlRequest('{ company { id } }', undefined, {
      headers: { authorization: 'Bearer forged' },
    });

    expect(Object.keys(headersOfCall(-1)).map((name) => name.toLowerCase())).not.toContain('authorization');
  });

  it('replaces a same-named header instead of duplicating it', async () => {
    const client = new MagentoClient(config, context);

    await client.graphqlRequest('{ company { id } }', undefined, { headers: { store: 'b2b-en' } });

    const headers = headersOfCall(-1);
    expect(headers['store']).toBe('b2b-en');
    expect(headers['Store']).toBeUndefined();
  });
});

describe('MagentoClient.getCustomerId', () => {
  it('is null for a guest without calling Magento', async () => {
    const client = new MagentoClient(config, context);

    await expect(client.getCustomerId()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('resolves the customer id once per token', async () => {
    await signIn();
    fetchMock.mockImplementation(async () => jsonResponse({ id: 42, email: 'a@example.com' }));
    const client = new MagentoClient(config, context);

    await expect(client.getCustomerId()).resolves.toBe(42);
    await expect(client.getCustomerId()).resolves.toBe(42);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await signIn('another-token');
    fetchMock.mockImplementation(async () => jsonResponse({ id: 7, email: 'b@example.com' }));
    await expect(client.getCustomerId()).resolves.toBe(7);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('is null when Magento rejects the token', async () => {
    await signIn('expired');
    fetchMock.mockImplementation(async () =>
      jsonResponse({ message: 'The consumer isn\'t authorized to access %resources.', parameters: { resources: 'self' } }, 401),
    );
    const client = new MagentoClient(config, context);

    await expect(client.getCustomerId()).resolves.toBeNull();
  });
});

describe('MagentoClient session helpers', () => {
  it('stores feature items apart from the client entries', async () => {
    const client = new MagentoClient(config, context);
    await client.setActiveCartId('cart-1');

    await client.setSessionItem('activeCartId', 'shadow');
    expect(await client.getSessionItem('activeCartId')).toBe('shadow');
    expect(await client.getActiveCartId()).toBe('cart-1');

    await client.removeSessionItem('activeCartId');
    expect(await client.getSessionItem('activeCartId')).toBeNull();
    expect(await client.getActiveCartId()).toBe('cart-1');
  });
});

describe('MagentoClient HTTP errors', () => {
  it('throws a MagentoApiError carrying the formatted Magento message', async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse(
        { message: 'No such entity with %fieldName = %fieldValue', parameters: { fieldName: 'cartId', fieldValue: 'abc' } },
        404,
      ),
    );
    const client = new MagentoClient(config, context);

    const failure = await client.getCart('abc').catch((err: unknown) => err);

    expect(failure).toBeInstanceOf(MagentoApiError);
    expect(failure).toBeInstanceOf(Error);
    expect(failure).toMatchObject({
      status: 404,
      method: 'GET',
      transport: 'rest',
      magentoMessage: 'No such entity with cartId = abc',
      url: 'https://shop.example.com/rest/b2c-en/V1/guest-carts/abc',
    });
  });

  it('resolves undefined for a missing order', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ message: 'The entity that was requested doesn\'t exist.' }, 404));
    const client = new MagentoClient(config, context);

    await expect(client.getOrderById('999')).resolves.toBeUndefined();
  });

  it('surfaces GraphQL error categories', async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({
        errors: [{ message: 'Product not found', extensions: { category: 'graphql-no-such-entity' } }],
      }),
    );
    const client = new MagentoClient(config, context);

    const failure = await client.graphqlRequest('{ products { items { sku } } }').catch((err: unknown) => err);

    expect(failure).toBeInstanceOf(MagentoApiError);
    if (failure instanceof MagentoApiError) {
      expect(failure.transport).toBe('graphql');
      expect(failure.categories).toEqual(['graphql-no-such-entity']);
      expect(failure.message).toContain('Product not found');
    }
  });
});
