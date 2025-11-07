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
import { describe, expect, it, beforeEach } from 'vitest';
import { CommercetoolsClient } from '../core/client.js';

describe('Commercetools Identity Provider', () => {
  let provider: CommercetoolsIdentityProvider;
  let cartProvider: CommercetoolsCartProvider;
  let reqCtx: RequestContext;

  beforeEach(async () => {
    reqCtx = createInitialRequestContext();
    const config = getCommercetoolsTestConfiguration();
    const client = new CommercetoolsClient(config, reqCtx);

    provider = new CommercetoolsIdentityProvider(
      config,
      IdentitySchema,
      new NoOpCache(),
      reqCtx,
      client
    );

    cartProvider = new CommercetoolsCartProvider(
      config,
      CartSchema,
      new NoOpCache(),
      reqCtx,
      client
    );
  });

  it('should default to an anonymous identity if no operations have been performed', async () => {
    const identity = await provider.getSelf({});

    expect(identity.type).toBe('Anonymous');
  });

  it('should automatically upgrade to guest the moment an operation is performed', async () => {
    const cart = await cartProvider.getActiveCartId();
    const updatedCart = await cartProvider.add(
      {
        cart,
        quantity: 1,
        variant: {
          sku: '8719514465190'
        },
      }
    );

    const identity = await provider.getSelf({});

    expect(identity.type).toBe('Guest');
  });

  it('should be able to register a new customer', async () => {
    const time = new Date().getTime();
    const identity = await provider.register(
      {
        username: `test-user+${time}@example.com`,
        password: 'love2test',
      }
    );

    expect(identity.type).toBe('Registered');

    const refreshedIdentity = await provider.getSelf({});
    expect(refreshedIdentity.type).toBe('Registered');
  });

  it('should be able to log out from a Registered identity', async () => {
    const time = new Date().getTime();
    const identity = await provider.register(
      {
        username: `test-user+${time}@example.com`,
        password: 'love2test',
      }
    );

    expect(identity.type).toBe('Registered');

    const loggedOutIdentity = await provider.logout({});
    expect(loggedOutIdentity.type).toBe('Anonymous');

    const refreshedIdentity = await provider.getSelf({});
    expect(refreshedIdentity.type).toBe('Anonymous');
  });
});
