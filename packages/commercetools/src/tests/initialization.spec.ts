import type { CommercetoolsConfiguration } from '@reactionary/provider-commercetools';
import { commercetoolsCapabilitiesInitializer } from '../lib/core/initialize.js';
import { CategorySchema, ProductSchema, createClient, createInitialRequestContext, type Result } from '@reactionary/core';
import { z } from 'zod';
import { expectTypeOf } from 'vitest';

describe('capability initialization', () => {
  const dummyConfig = {
    apiUrl: '',
    authUrl: '',
    clientId: '',
    clientSecret: '',
    facetFieldsForSearch: [],
    paymentMethods: [],
    projectKey: '',
    scopes: []
  } satisfies CommercetoolsConfiguration;

  const dummyContext = createInitialRequestContext();

  it('can initialize with all capabilities by default', () => {
    const withContext = commercetoolsCapabilitiesInitializer(dummyConfig);
    const client = withContext({ request: dummyContext });

    expect(client.product).toBeDefined();
    expect(client.cart).toBeDefined();
    expect(client.category).toBeDefined();
  });

  it('can initialize the provider capabilities selectively', () => {
    const withContext = commercetoolsCapabilitiesInitializer(dummyConfig, {
      product: true,
    });
    const client = withContext({ request: dummyContext });

    expect(client.product).toBeDefined();
    expect('cart' in client).toBe(false);
    expect('category' in client).toBe(false);
  });

  it('can initialize cart capability selectively', () => {
    const withContext = commercetoolsCapabilitiesInitializer(dummyConfig, {
      cart: true,
    });
    const client = withContext({ request: dummyContext });

    expect(client.cart).toBeDefined();
    expect('product' in client).toBe(false);
    expect('category' in client).toBe(false);
  });

  it('can initialize category capability selectively', () => {
    const withContext = commercetoolsCapabilitiesInitializer(dummyConfig, {
      category: true,
    });
    const client = withContext({ request: dummyContext });

    expect(client.category).toBeDefined();
    expect('product' in client).toBe(false);
    expect('cart' in client).toBe(false);
  });

  it('can combine two selective clients into a single client shape', () => {
    const withProduct = commercetoolsCapabilitiesInitializer(dummyConfig, {
      product: true,
    });
    const withCart = commercetoolsCapabilitiesInitializer(dummyConfig, {
      cart: true,
    });

    const combinedClient = createClient(
      { request: dummyContext },
      withProduct,
      withCart,
    );

    expect(combinedClient.product).toBeDefined();
    expect(combinedClient.cart).toBeDefined();
  });

  it('can expose an extended product output schema through the public capability API', async () => {
    const ExtendedProductSchema = ProductSchema.extend({
      merchandisingTag: z.string(),
    });

    const withContext = commercetoolsCapabilitiesInitializer(
      dummyConfig,
      {
        product: true,
      },
      {
        product: {
          schema: ExtendedProductSchema,
          transform: ({ product }) => ({
            ...product,
            merchandisingTag: 'featured',
          }),
        },
      }
    );
    const client = withContext({ request: dummyContext });

    expectTypeOf<Awaited<ReturnType<typeof client.product.byId.execute>>>().toEqualTypeOf<
      Result<z.infer<typeof ExtendedProductSchema>>
    >();
  });

  it('can expose extended category output types across category procedures', () => {
    const ExtendedCategorySchema = CategorySchema.extend({
      merchandisingTag: z.string(),
    });

    const withContext = commercetoolsCapabilitiesInitializer(
      dummyConfig,
      {
        category: true,
      },
      {
        category: {
          schema: ExtendedCategorySchema,
          transform: ({ category }) => ({
            ...category,
            merchandisingTag: 'navigation',
          }),
        },
      }
    );
    const client = withContext({ request: dummyContext });

    expectTypeOf<Awaited<ReturnType<typeof client.category.byId.execute>>>().toEqualTypeOf<
      Result<z.infer<typeof ExtendedCategorySchema>>
    >();
    expectTypeOf<Awaited<ReturnType<typeof client.category.breadcrumbPath.execute>>>().toEqualTypeOf<
      Result<Array<z.infer<typeof ExtendedCategorySchema>>>
    >();
    expectTypeOf<Awaited<ReturnType<typeof client.category.childCategories.execute>>>().toMatchTypeOf<
      Result<{
        items: Array<z.infer<typeof ExtendedCategorySchema>>;
      }>
    >();
  });
});
