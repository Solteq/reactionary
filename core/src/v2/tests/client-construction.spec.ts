import { describe, it, expect, assert } from 'vitest';
import { createInitialRequestContext } from '../../initialization.js';
import type { RequestContext } from '../../schemas/session.schema.js';
import { createClient } from '../core/client.js';
import { mergeDefsFor } from '../core/provider.js';
import { providerBarInitializer } from '../examples/provider-bar/capabilities.js';
import { providerFooInitializer } from '../examples/provider-foo/capabilities.js';

describe('Client Creation', () => {
  it('can create a typed client based on a single provider', async () => {
    const context = createInitialRequestContext();
    const capability = providerFooInitializer({ product: true });
    const client = createClient(capability, context);

    expect(client.product.byId.execute).toBeDefined();
    expect(client.product.bySlug.execute).toBeDefined();

    const res = await client.product.byId.execute({ identifier: { key: '1' } });

    if (!res.success) {
      assert.fail();
    }

    expect(res.value).toBeDefined();
  });

  it('can create a typed client based on multiple providers', async () => {
    const context = createInitialRequestContext();
    const merge = mergeDefsFor<RequestContext>();

    const capabilities = merge(
      providerFooInitializer({ product: true }),
      providerBarInitializer({ category: true }),
    );
    const client = createClient(capabilities, context);

    expect(client.product.byId.execute).toBeDefined();
    expect(client.category.byId.execute).toBeDefined();

    const res = await client.product.byId.execute({ identifier: { key: '1' } });

    if (!res.success) {
      assert.fail();
    }

    expect(res.value).toBeDefined();
  });
});
