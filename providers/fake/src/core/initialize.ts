import type { Cache as ReactinaryCache, RequestContext } from '@reactionary/core';
import {
  CartIdentifierSchema as CoreCartIdentifierSchema,
  CartSchema as CoreCartSchema,
  CategoryPaginatedResultSchema as CoreCategoryPaginatedResultSchema,
  CategorySchema as CoreCategorySchema,
  CheckoutSchema as CoreCheckoutSchema,
  IdentitySchema as CoreIdentitySchema,
  InventorySchema as CoreInventorySchema,
  OrderSchema as CoreOrderSchema,
  OrderSearchResultSchema as CoreOrderSearchResultSchema,
  PaymentMethodSchema as CorePaymentMethodSchema,
  PriceSchema as CorePriceSchema,
  ProductAssociationSchema as CoreProductAssociationSchema,
  ProductRatingSummarySchema as CoreProductRatingSummarySchema,
  ProductReviewPaginatedResultSchema as CoreProductReviewPaginatedResultSchema,
  ProductReviewSchema as CoreProductReviewSchema,
  ProductSchema as CoreProductSchema,
  ProductSearchResultSchema as CoreProductSearchResultSchema,
  ProfileSchema as CoreProfileSchema,
  ShippingMethodSchema as CoreShippingMethodSchema,
  StoreSchema as CoreStoreSchema,
} from '@reactionary/core';
import { FakeProductProvider } from '../providers/product.provider.js';
import { FakeSearchProvider } from '../providers/product-search.provider.js';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import type { FakeCapabilities } from '../schema/capabilities.schema.js';
import { FakeCapabilitiesSchema } from '../schema/capabilities.schema.js';
import { FakeCategoryProvider } from '../providers/category.provider.js';
import {
  FakeCartProvider,
  FakeIdentityProvider,
  FakeInventoryProvider,
  FakePriceProvider,
  FakeStoreProvider,
} from '../providers/index.js';
import { FakeCheckoutProvider } from '../providers/checkout.provider.js';
import { FakeOrderSearchProvider } from '../providers/order-search.provider.js';
import { FakeOrderProvider } from '../providers/order.provider.js';
import { FakeProfileProvider } from '../providers/profile.provider.js';
import { FakeProductReviewsProvider } from '../providers/product-reviews.provider.js';
import { FakeProductAssociationsProvider } from '../providers/product-associations.provider.js';
import {
  FakeCartFactory,
  FakeCategoryFactory,
  FakeCheckoutFactory,
  FakeIdentityFactory,
  FakeInventoryFactory,
  FakeOrderFactory,
  FakeOrderSearchFactory,
  FakePriceFactory,
  FakeProductAssociationsFactory,
  FakeProductFactory,
  FakeProductReviewsFactory,
  FakeProductSearchFactory,
  FakeProfileFactory,
  FakeStoreFactory,
} from '../factories/index.js';
import {
  type FakeClientFromCapabilities,
  resolveCapabilityProvider,
} from './initialize.types.js';

export function withFakeCapabilities<T extends FakeCapabilities>(
  configuration: FakeConfiguration,
  capabilities: T,
) {
  return (
    cache: ReactinaryCache,
    context: RequestContext,
  ): FakeClientFromCapabilities<T> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client: any = {};
    const caps = FakeCapabilitiesSchema.parse(capabilities);

    const buildProviderArgs = <TFactory,>(factory: TFactory) => ({
      cache,
      context,
      config: configuration,
      factory,
    });

    if (caps.product?.enabled) {
      client.product = resolveCapabilityProvider(
        capabilities.product,
        {
          factory: new FakeProductFactory(CoreProductSchema),
          provider: (args) =>
            new FakeProductProvider(args.config, args.cache, args.context, args.factory),
        },
        buildProviderArgs,
      );
    }

    if (caps.productSearch?.enabled) {
      client.productSearch = resolveCapabilityProvider(
        capabilities.productSearch,
        {
          factory: new FakeProductSearchFactory(CoreProductSearchResultSchema),
          provider: (args) =>
            new FakeSearchProvider(args.config, args.cache, args.context, args.factory),
        },
        buildProviderArgs,
      );
    }

    if (caps.category?.enabled) {
      client.category = resolveCapabilityProvider(
        capabilities.category,
        {
          factory: new FakeCategoryFactory(
            CoreCategorySchema,
            CoreCategoryPaginatedResultSchema,
          ),
          provider: (args) =>
            new FakeCategoryProvider(args.config, args.cache, args.context, args.factory),
        },
        buildProviderArgs,
      );
    }

    if (caps.cart?.enabled) {
      client.cart = resolveCapabilityProvider(
        capabilities.cart,
        {
          factory: new FakeCartFactory(CoreCartSchema, CoreCartIdentifierSchema),
          provider: (args) =>
            new FakeCartProvider(args.config, args.cache, args.context, args.factory),
        },
        buildProviderArgs,
      );
    }

    if (caps.inventory?.enabled) {
      client.inventory = resolveCapabilityProvider(
        capabilities.inventory,
        {
          factory: new FakeInventoryFactory(CoreInventorySchema),
          provider: (args) =>
            new FakeInventoryProvider(args.config, args.cache, args.context, args.factory),
        },
        buildProviderArgs,
      );
    }

    if (caps.store?.enabled) {
      client.store = resolveCapabilityProvider(
        capabilities.store,
        {
          factory: new FakeStoreFactory(CoreStoreSchema),
          provider: (args) =>
            new FakeStoreProvider(args.config, args.cache, args.context, args.factory),
        },
        buildProviderArgs,
      );
    }

    if (caps.price?.enabled) {
      client.price = resolveCapabilityProvider(
        capabilities.price,
        {
          factory: new FakePriceFactory(CorePriceSchema),
          provider: (args) =>
            new FakePriceProvider(args.config, args.cache, args.context, args.factory),
        },
        buildProviderArgs,
      );
    }

    if (caps.identity?.enabled) {
      client.identity = resolveCapabilityProvider(
        capabilities.identity,
        {
          factory: new FakeIdentityFactory(CoreIdentitySchema),
          provider: (args) =>
            new FakeIdentityProvider(args.config, args.cache, args.context, args.factory),
        },
        buildProviderArgs,
      );
    }

    if (caps.checkout?.enabled) {
      client.checkout = resolveCapabilityProvider(
        capabilities.checkout,
        {
          factory: new FakeCheckoutFactory(
            CoreCheckoutSchema,
            CoreShippingMethodSchema,
            CorePaymentMethodSchema,
          ),
          provider: (args) =>
            new FakeCheckoutProvider(args.config, args.cache, args.context, args.factory),
        },
        buildProviderArgs,
      );
    }

    if (caps.orderSearch?.enabled) {
      client.orderSearch = resolveCapabilityProvider(
        capabilities.orderSearch,
        {
          factory: new FakeOrderSearchFactory(CoreOrderSearchResultSchema),
          provider: (args) =>
            new FakeOrderSearchProvider(args.config, args.cache, args.context, args.factory),
        },
        buildProviderArgs,
      );
    }

    if (caps.order?.enabled) {
      client.order = resolveCapabilityProvider(
        capabilities.order,
        {
          factory: new FakeOrderFactory(CoreOrderSchema),
          provider: (args) =>
            new FakeOrderProvider(args.config, args.cache, args.context, args.factory),
        },
        buildProviderArgs,
      );
    }

    if (caps.profile?.enabled) {
      client.profile = resolveCapabilityProvider(
        capabilities.profile,
        {
          factory: new FakeProfileFactory(CoreProfileSchema),
          provider: (args) =>
            new FakeProfileProvider(args.config, args.cache, args.context, args.factory),
        },
        buildProviderArgs,
      );
    }

    if (caps.productReviews?.enabled) {
      client.productReviews = resolveCapabilityProvider(
        capabilities.productReviews,
        {
          factory: new FakeProductReviewsFactory(
            CoreProductRatingSummarySchema,
            CoreProductReviewSchema,
            CoreProductReviewPaginatedResultSchema,
          ),
          provider: (args) =>
            new FakeProductReviewsProvider(
              args.config,
              args.cache,
              args.context,
              args.factory,
            ),
        },
        buildProviderArgs,
      );
    }

    if (caps.productAssociations?.enabled) {
      client.productAssociations = resolveCapabilityProvider(
        capabilities.productAssociations,
        {
          factory: new FakeProductAssociationsFactory(CoreProductAssociationSchema),
          provider: (args) =>
            new FakeProductAssociationsProvider(
              args.config,
              args.cache,
              args.context,
              args.factory,
            ),
        },
        buildProviderArgs,
      );
    }

    return client;
  };
}
