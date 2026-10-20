import type { RequestContext } from '@reactionary/core';
import { NoOpCache, createInitialRequestContext } from '@reactionary/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MagentoIdentityCapability,
  deriveNameFromEmail,
} from '../capabilities/identity.capability.js';
import { MagentoClient } from '../core/client.js';
import { MagentoApiError } from '../core/errors.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';

const config: MagentoConfiguration = {
  adminApiKey: 'token',
  baseUrl: 'https://example.com',
  mediaSource: 'DEFAULT',
  defaultCurrency: 'EUR',
  rootCategoryId: '2',
  allCurrencies: ['EUR'],
  storeBaseCode: 'default',
  authStoreCode: 'default',
};

function apiError(status: number, magentoMessage = 'failure'): MagentoApiError {
  return new MagentoApiError({
    transport: 'rest',
    status,
    method: 'POST',
    url: 'https://example.com/rest/default/V1/integration/customer/token',
    magentoMessage,
  });
}

describe('deriveNameFromEmail', () => {
  it('splits the local part into first and last name', () => {
    expect(deriveNameFromEmail('jane.doe@example.com')).toEqual({
      firstname: 'Jane',
      lastname: 'Doe',
    });
  });

  it('reuses a single-word local part for both names', () => {
    expect(deriveNameFromEmail('jane@example.com')).toEqual({
      firstname: 'Jane',
      lastname: 'Jane',
    });
  });
});

describe('MagentoIdentityCapability', () => {
  let reqCtx: RequestContext;
  let client: MagentoClient;
  let capability: MagentoIdentityCapability;
  let token: string | null;
  let cartId: string | null;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    client = new MagentoClient(config, reqCtx);
    token = null;
    cartId = null;
    vi.spyOn(client, 'getCustomerToken').mockImplementation(async () => token);
    vi.spyOn(client, 'getActiveCartId').mockImplementation(async () => cartId);
    vi.spyOn(client, 'getCustomerId').mockResolvedValue(7);
    vi.spyOn(client, 'login').mockImplementation(async () => {
      token = 'customer-token';
      return token;
    });
    vi.spyOn(client, 'logout').mockImplementation(async () => {
      token = null;
    });
    vi.spyOn(client, 'clearActiveCartId').mockImplementation(async () => {
      cartId = null;
    });
    vi.spyOn(client, 'register').mockImplementation(async (customer) => ({
      id: 7,
      ...customer,
    }));
    capability = new MagentoIdentityCapability(config, new NoOpCache(), reqCtx, client);
  });

  describe('getSelf', () => {
    it('is anonymous without token or cart', async () => {
      const result = await capability.getSelf({});

      expect(result.success && result.value).toEqual({ type: 'Anonymous' });
    });

    it('is registered with a valid token', async () => {
      token = 'customer-token';

      const result = await capability.getSelf({});

      expect(result.success && result.value).toEqual({
        type: 'Registered',
        id: { userId: '7' },
      });
    });

    it('clears a rejected token and falls back to anonymous', async () => {
      token = 'stale-token';
      vi.spyOn(client, 'getCustomerId').mockResolvedValue(null);

      const result = await capability.getSelf({});

      expect(client.logout).toHaveBeenCalled();
      expect(token).toBeNull();
      expect(result.success && result.value).toEqual({ type: 'Anonymous' });
    });

    it('returns a typed error when Magento fails otherwise', async () => {
      token = 'customer-token';
      vi.spyOn(client, 'getCustomerId').mockRejectedValue(apiError(503));

      const result = await capability.getSelf({});

      expect(!result.success && result.error.type).toBe('Generic');
      expect(client.logout).not.toHaveBeenCalled();
    });

    it('is a guest with a stable, non-cart id when a cart exists', async () => {
      cartId = 'masked-cart-id';

      const first = await capability.getSelf({});
      const second = await capability.getSelf({});

      expect(first.success).toBe(true);
      if (first.success && second.success) {
        expect(first.value.type).toBe('Guest');
        if (first.value.type === 'Guest' && second.value.type === 'Guest') {
          expect(first.value.id.userId).toMatch(/^guest-/);
          expect(first.value.id.userId).not.toContain('masked-cart-id');
          expect(second.value.id.userId).toBe(first.value.id.userId);
        }
      }
    });
  });

  describe('login', () => {
    it('returns the registered identity', async () => {
      const result = await capability.login({ username: 'jane@example.com', password: 'Secret1!' });

      expect(result.success && result.value).toEqual({
        type: 'Registered',
        id: { userId: '7' },
      });
    });

    it('returns InvalidInput for bad credentials', async () => {
      vi.spyOn(client, 'login').mockRejectedValue(
        apiError(401, 'The account sign-in was incorrect.'),
      );

      const result = await capability.login({ username: 'jane@example.com', password: 'wrong' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toEqual({
          type: 'InvalidInput',
          error: 'The account sign-in was incorrect.',
        });
      }
    });

    it('returns Generic for other failures', async () => {
      vi.spyOn(client, 'login').mockRejectedValue(apiError(500));

      const result = await capability.login({ username: 'jane@example.com', password: 'x' });

      expect(!result.success && result.error.type).toBe('Generic');
    });
  });

  describe('logout', () => {
    it('clears both the customer token and the active cart', async () => {
      token = 'customer-token';
      cartId = 'customer-cart';

      const result = await capability.logout({});

      expect(token).toBeNull();
      expect(cartId).toBeNull();
      expect(result.success && result.value).toEqual({ type: 'Anonymous' });
    });

    it('returns a typed error when clearing the session fails', async () => {
      vi.spyOn(client, 'logout').mockRejectedValue(new Error('session store down'));

      const result = await capability.logout({});

      expect(!result.success && result.error.type).toBe('Generic');
    });
  });

  describe('register', () => {
    it('uses names passed on the loose payload', async () => {
      // The core register schema is a loose object, so extra fields pass through.
      const payload = {
        username: 'jane@example.com',
        password: 'Secret1!',
        firstName: 'Janet',
        lastName: 'Smith',
      };
      await capability.register(payload);

      expect(client.register).toHaveBeenCalledWith(
        { email: 'jane@example.com', firstname: 'Janet', lastname: 'Smith' },
        'Secret1!',
      );
    });

    it('derives names from the e-mail when none are given', async () => {
      const result = await capability.register({
        username: 'jane.doe@example.com',
        password: 'Secret1!',
      });

      expect(client.register).toHaveBeenCalledWith(
        { email: 'jane.doe@example.com', firstname: 'Jane', lastname: 'Doe' },
        'Secret1!',
      );
      expect(result.success && result.value.type).toBe('Registered');
    });

    it('returns InvalidInput for a duplicate e-mail', async () => {
      vi.spyOn(client, 'register').mockRejectedValue(
        apiError(400, 'A customer with the same email address already exists in an associated website.'),
      );

      const result = await capability.register({
        username: 'jane@example.com',
        password: 'Secret1!',
      });

      expect(!result.success && result.error.type).toBe('InvalidInput');
      expect(client.login).not.toHaveBeenCalled();
    });
  });
});
