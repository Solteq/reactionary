import 'dotenv/config';
import type { RequestContext } from '@reactionary/core';
import {
  CartSchema,
  IdentitySchema,
  NoOpCache,
  createInitialRequestContext,
} from '@reactionary/core';
import { getCommercetoolsTestConfiguration } from './test-utils.js';
import { CommercetoolsIdentityProvider } from '../providers/identity.provider.js';
import { CommercetoolsCartProvider } from '../providers/cart.provider.js';
import { describe, expect, it, beforeAll, beforeEach } from 'vitest';

describe('Commercetools Identity Provider', () => {
  let provider: CommercetoolsIdentityProvider;
  let cartProvider: CommercetoolsCartProvider;
  let reqCtx: RequestContext;

  beforeAll(() => {
    provider = new CommercetoolsIdentityProvider(
      getCommercetoolsTestConfiguration(),
      IdentitySchema,
      new NoOpCache()
    );

    cartProvider = new CommercetoolsCartProvider(
      getCommercetoolsTestConfiguration(),
      CartSchema,
      new NoOpCache()
    );
  });

  beforeEach(async () => {
    reqCtx = createInitialRequestContext();
  });

  it('should default to an anonymous identity if no operations have been performed', async () => {
    const identity = await provider.getSelf({}, reqCtx);

    expect(identity.type).toBe('Anonymous');
  });

  it('should automatically upgrade to guest the moment an operation is performed', async () => {
    const cart = await cartProvider.getActiveCartId(reqCtx);
    const updatedCart = await cartProvider.add(
      {
        cart,
        quantity: 1,
        variant: {
          sku: 'SGB-01',
        },
      },
      reqCtx
    );

    const identity = await provider.getSelf({}, reqCtx);

    expect(identity.type).toBe('Guest');
  });

  it('should be able to register a new customer', async () => {
    const time = new Date().getTime();
    const identity = await provider.register(
      {
        username: `test-user+${time}@example.com`,
        password: 'love2test',
      },
      reqCtx
    );

    expect(identity.type).toBe('Registered');
  });

  it('should be able to log out from a Registered identity', async () => {
    const time = new Date().getTime();
    const identity = await provider.register(
      {
        username: `test-user+${time}@example.com`,
        password: 'love2test',
      },
      reqCtx
    );

    expect(identity.type).toBe('Registered');

    const loggedOutIdentity = await provider.logout({}, reqCtx);
    expect(loggedOutIdentity.type).toBe('Anonymous');
  });
});
