import 'dotenv/config';
import { describe, expect, it } from 'vitest';
import { CommercetoolsAPI } from '../core/client.js';
import { getCommercetoolsTestConfiguration } from './test-utils.js';
import {
  createInitialRequestContext,
  type RequestContext,
} from '@reactionary/core';
import type { ApiRoot } from '@commercetools/platform-sdk';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';

function setup() {
  const config = getCommercetoolsTestConfiguration();
  const context = createInitialRequestContext();
  const root = new CommercetoolsAPI(config, context);

  return {
    config,
    context,
    root,
  };
}

async function createCart(
  client: ApiRoot,
  context: RequestContext,
  config: CommercetoolsConfiguration
) {
  const cart = await client
    .withProjectKey({ projectKey: config.projectKey })
    .me()
    .carts()
    .post({
      body: {
        currency: context.languageContext.currencyCode,
        lineItems: [
          {
            sku: '0766623301831',
            distributionChannel: {
              typeId: 'channel',
              key: 'OnlineFfmChannel',
            },
          },
        ],
      },
    })
    .execute();

  return cart;
}

describe('Commercetools Identity', () => {
  it('initially is considered anonymous', async () => {
    const { root } = setup();

    const initialSelf = await root.introspect();
    expect(initialSelf.type).toBe('Anonymous');
  });

  it('becomes a guest when acquiring a client for user operations', async () => {
    const { root } = setup();

    const client = await root.getClient();
    const guestSelf = await root.introspect();
    expect(guestSelf.type).toBe('Guest');
  });

it('can login from being anonymous', async () => {
    const { config, context, root } = setup();

    // After a login, we are expected to be Registered
    const identity = await root.login('asger.jensen3@solteq.com', 'test12345');
    expect(identity.type).toBe('Registered');

    // And we expect the introspected result of what is in token-cache to match that...
    const introspectedRegisteredIdentity = await root.introspect();
    expect(introspectedRegisteredIdentity.type).toBe('Registered');

    // Finally, we expect to be able to perform an add-to-cart (only acquiring client AFTER being logged in)
    const client = await root.getClient();
    const cart = await createCart(client, context, config);

    expect(cart.body.id).toBeDefined();
    expect(cart.body.lineItems.length).toBe(1);
    expect(cart.body.customerId).toBe(identity.id.userId);
  });

  it('can login from being guest', async () => {
    const { config, context, root } = setup();

    // Become guest by acquiring a client
    const client = await root.getClient();

    // After a login, we are expected to be Registered
    const identity = await root.login('asger.jensen3@solteq.com', 'test12345');
    expect(identity.type).toBe('Registered');

    // And we expect the introspected result of what is in token-cache to match that...
    const introspectedRegisteredIdentity = await root.introspect();
    expect(introspectedRegisteredIdentity.type).toBe('Registered');

    // Finally, we expect to be able to perform an add-to-cart
    const cart = await createCart(client, context, config);

    expect(cart.body.id).toBeDefined();
    expect(cart.body.lineItems.length).toBe(1);
    expect(cart.body.customerId).toBe(identity.id.userId);
  });
});
