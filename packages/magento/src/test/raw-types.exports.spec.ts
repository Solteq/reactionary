import { describe, expectTypeOf, it } from 'vitest';
import type * as Root from '../index.js';
import type * as RawTypes from '../schema/magento.types.js';

// Root exports are referenced through the namespace (not named imports) so a
// missing export fails inside the test block, where Vitest's typecheck reports it.
describe('package root raw Magento type exports', () => {
  it('exposes the raw Magento API types storefronts extend', () => {
    expectTypeOf<Root.MagentoProduct>().toEqualTypeOf<RawTypes.MagentoProduct>();
    expectTypeOf<Root.MagentoCategory>().toEqualTypeOf<RawTypes.MagentoCategory>();
    expectTypeOf<Root.MagentoProductSearchResult>().toEqualTypeOf<RawTypes.MagentoProductSearchResult>();
    expectTypeOf<Root.MagentoCheckoutState>().toEqualTypeOf<RawTypes.MagentoCheckoutState>();
    expectTypeOf<Root.MagentoCheckoutAddress>().toEqualTypeOf<RawTypes.MagentoCheckoutAddress>();
    expectTypeOf<Root.MagentoCustomAttribute>().toEqualTypeOf<RawTypes.MagentoCustomAttribute>();
  });

  it('keeps the already-exported client, configuration and customer types', () => {
    expectTypeOf<Root.Magento>().toHaveProperty('auth');
    expectTypeOf<Root.MagentoConfiguration>().toHaveProperty('baseUrl');
    expectTypeOf<Root.MagentoCustomer>().toHaveProperty('email');
  });
});
