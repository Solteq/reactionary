import 'dotenv/config';
import { describe, expect, it, beforeEach, assert } from 'vitest';
import { createClient, PrimaryProvider } from '../utils.js';

const testData = {
  sku: '0766623301831'
}

describe.each([PrimaryProvider.COMMERCETOOLS, PrimaryProvider.MEDUSA])('Identity Capability - %s', (provider) => {
  let client: ReturnType<typeof createClient>;

  beforeEach(() => {
    client = createClient(provider);
  });

  it('should default to an anonymous identity if no operations have been performed', async () => {
    const identity = await client.identity.getSelf({});

    if (!identity.success) {
      assert.fail();
    }

    expect(identity.value.type).toBe('Anonymous');
  });

  it('should automatically upgrade to guest the moment an operation is performed', async () => {
    const updatedCart = await client.cart.createCart({});

    if (!updatedCart.success) {
      assert.fail(JSON.stringify(updatedCart.error));
    }

    const identity = await client.identity.getSelf({});

    if (!identity.success) {
      assert.fail(JSON.stringify(identity.error));
    }

    expect(identity.value.type).toBe('Guest');
  });

  it('should be able to register a new customer', async () => {
    const time = new Date().getTime();
    const identity = await client.identity.register(
      {
        username: `test-user+${time}@example.com`,
        password: 'love2test',
      }
    );

    if (!identity.success) {
      assert.fail();
    }

    expect(identity.value.type).toBe('Registered');

    const refreshedIdentity = await client.identity.getSelf({});

    if (!refreshedIdentity.success) {
      assert.fail();
    }
    expect(refreshedIdentity.value.type).toBe('Registered');
  });

  it('should be able to log out from a Registered identity', async () => {
    const time = new Date().getTime();
    const identity = await client.identity.register(
      {
        username: `test-user+${time}@example.com`,
        password: 'love2test',
      }
    );

    if (!identity.success) {
      assert.fail();
    }

    expect(identity.value.type).toBe('Registered');

    const loggedOutIdentity = await client.identity.logout({});

    if (!loggedOutIdentity.success) {
      assert.fail();
    }
    expect(loggedOutIdentity.value.type).toBe('Anonymous');

    const refreshedIdentity = await client.identity.getSelf({});

    if (!refreshedIdentity.success) {
      assert.fail();
    }
    expect(refreshedIdentity.value.type).toBe('Anonymous');
  });
});
