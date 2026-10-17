import { createInitialRequestContext } from '@reactionary/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MagentoClient,
  getMagentoCustomerToken,
  setMagentoCustomerToken,
} from '../core/client.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';

const config: MagentoConfiguration = {
  adminApiKey: 'admin-key',
  baseUrl: 'https://example.com',
  mediaSource: 'DEFAULT',
  defaultCurrency: 'EUR',
  rootCategoryId: '2',
  allCurrencies: ['EUR'],
  storeCode: 'default',
  authStoreCode: 'default',
};

function authorizationOf(call: Parameters<typeof fetch>): string | undefined {
  const headers = call[1]?.headers as Record<string, string> | undefined;
  return headers?.['Authorization'];
}

describe('Magento customer token helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when no customer token has been set', async () => {
    const context = createInitialRequestContext();

    await expect(getMagentoCustomerToken(context)).resolves.toBeNull();
  });

  it('reads back a token set on the context', async () => {
    const context = createInitialRequestContext();

    await setMagentoCustomerToken(context, 'customer-token');

    await expect(getMagentoCustomerToken(context)).resolves.toBe(
      'customer-token',
    );
  });

  it('exposes the token to a MagentoClient built from the context', async () => {
    const context = createInitialRequestContext();
    await setMagentoCustomerToken(context, 'customer-token');

    const client = new MagentoClient(config, context);

    await expect(client.getCustomerToken()).resolves.toBe('customer-token');
  });

  it('sends the token as the bearer on customer REST calls', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 1 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const context = createInitialRequestContext();
    await setMagentoCustomerToken(context, 'customer-token');

    await new MagentoClient(config, context).getMe();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(authorizationOf(fetchSpy.mock.calls[0])).toBe(
      'Bearer customer-token',
    );
  });

  it('reads a token stored by MagentoClient.login', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify('logged-in-token'), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const context = createInitialRequestContext();

    await new MagentoClient(config, context).login('a@example.com', 'secret');

    await expect(getMagentoCustomerToken(context)).resolves.toBe(
      'logged-in-token',
    );
  });
});
