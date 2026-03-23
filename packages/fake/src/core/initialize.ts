import type { Cache as ReactinaryCache, RequestContext } from '@reactionary/core';
import {
  CartIdentifierSchema as CoreCartIdentifierSchema,
  CartPaginatedSearchResultSchema as CoreCartPaginatedSearchResultSchema,
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
import { FakeProductCapability } from '../capabilities/product.capability.js';
import { FakeProductSearchCapability } from '../capabilities/product-search.capability.js';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import type { FakeCapabilities } from '../schema/capabilities.schema.js';
import { FakeCapabilitiesSchema } from '../schema/capabilities.schema.js';
import { FakeCategoryCapability } from '../capabilities/category.capability.js';
import {
  FakeCartCapability,
  FakeIdentityCapability,
  FakeInventoryCapability,
  FakePriceCapability,
  FakeStoreCapability,
} from '../capabilities/index.js';
import { FakeCheckoutCapability } from '../capabilities/checkout.capability.js';
import { FakeOrderSearchCapability } from '../capabilities/order-search.capability.js';
import { FakeOrderCapability } from '../capabilities/order.capability.js';
import { FakeProfileCapability } from '../capabilities/profile.capability.js';
import { FakeProductReviewsCapability } from '../capabilities/product-reviews.capability.js';
import { FakeProductAssociationsCapability } from '../capabilities/product-associations.capability.js';
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
  resolveCapabilityWithFactory,
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

    const buildCapabilityArgs = <TFactory,>(factory: TFactory) => ({
      cache,
      context,
      config: configuration,
      factory,
    });

    if (caps.product?.enabled) {
      client.product = resolveCapabilityWithFactory(
        capabilities.product,
        {
          factory: new FakeProductFactory(CoreProductSchema),
          capability: (args) =>
            new FakeProductCapability(args.config, args.cache, args.context, args.factory),
        },
        buildCapabilityArgs,
      );
    }

    if (caps.productSearch?.enabled) {
      client.productSearch = resolveCapabilityWithFactory(
        capabilities.productSearch,
        {
          factory: new FakeProductSearchFactory(CoreProductSearchResultSchema),
          capability: (args) =>
            new FakeProductSearchCapability(args.config, args.cache, args.context, args.factory),
        },
        buildCapabilityArgs,
      );
    }

    if (caps.category?.enabled) {
      client.category = resolveCapabilityWithFactory(
        capabilities.category,
        {
          factory: new FakeCategoryFactory(
            CoreCategorySchema,
            CoreCategoryPaginatedResultSchema,
          ),
          capability: (args) =>
            new FakeCategoryCapability(args.config, args.cache, args.context, args.factory),
        },
        buildCapabilityArgs,
      );
    }

    if (caps.cart?.enabled) {
      client.cart = resolveCapabilityWithFactory(
        capabilities.cart,
        {
          factory: new FakeCartFactory(
            CoreCartSchema,
            CoreCartIdentifierSchema,
            CoreCartPaginatedSearchResultSchema,
          ),
          capability: (args) =>
            new FakeCartCapability(args.config, args.cache, args.context, args.factory),
        },
        buildCapabilityArgs,
      );
    }

    if (caps.inventory?.enabled) {
      client.inventory = resolveCapabilityWithFactory(
        capabilities.inventory,
        {
          factory: new FakeInventoryFactory(CoreInventorySchema),
          capability: (args) =>
            new FakeInventoryCapability(args.config, args.cache, args.context, args.factory),
        },
        buildCapabilityArgs,
      );
    }

    if (caps.store?.enabled) {
      client.store = resolveCapabilityWithFactory(
        capabilities.store,
        {
          factory: new FakeStoreFactory(CoreStoreSchema),
          capability: (args) =>
            new FakeStoreCapability(args.config, args.cache, args.context, args.factory),
        },
        buildCapabilityArgs,
      );
    }

    if (caps.price?.enabled) {
      client.price = resolveCapabilityWithFactory(
        capabilities.price,
        {
          factory: new FakePriceFactory(CorePriceSchema),
          capability: (args) =>
            new FakePriceCapability(args.config, args.cache, args.context, args.factory),
        },
        buildCapabilityArgs,
      );
    }

    if (caps.identity?.enabled) {
      client.identity = resolveCapabilityWithFactory(
        capabilities.identity,
        {
          factory: new FakeIdentityFactory(CoreIdentitySchema),
          capability: (args) =>
            new FakeIdentityCapability(args.config, args.cache, args.context, args.factory),
        },
        buildCapabilityArgs,
      );
    }

    if (caps.checkout?.enabled) {
      client.checkout = resolveCapabilityWithFactory(
        capabilities.checkout,
        {
          factory: new FakeCheckoutFactory(
            CoreCheckoutSchema,
            CoreShippingMethodSchema,
            CorePaymentMethodSchema,
          ),
          capability: (args) =>
            new FakeCheckoutCapability(args.config, args.cache, args.context, args.factory),
        },
        buildCapabilityArgs,
      );
    }

    if (caps.orderSearch?.enabled) {
      client.orderSearch = resolveCapabilityWithFactory(
        capabilities.orderSearch,
        {
          factory: new FakeOrderSearchFactory(CoreOrderSearchResultSchema),
          capability: (args) =>
            new FakeOrderSearchCapability(args.config, args.cache, args.context, args.factory),
        },
        buildCapabilityArgs,
      );
    }

    if (caps.order?.enabled) {
      client.order = resolveCapabilityWithFactory(
        capabilities.order,
        {
          factory: new FakeOrderFactory(CoreOrderSchema),
          capability: (args) =>
            new FakeOrderCapability(args.config, args.cache, args.context, args.factory),
        },
        buildCapabilityArgs,
      );
    }

    if (caps.profile?.enabled) {
      client.profile = resolveCapabilityWithFactory(
        capabilities.profile,
        {
          factory: new FakeProfileFactory(CoreProfileSchema),
          capability: (args) =>
            new FakeProfileCapability(args.config, args.cache, args.context, args.factory),
        },
        buildCapabilityArgs,
      );
    }

    if (caps.productReviews?.enabled) {
      client.productReviews = resolveCapabilityWithFactory(
        capabilities.productReviews,
        {
          factory: new FakeProductReviewsFactory(
            CoreProductRatingSummarySchema,
            CoreProductReviewSchema,
            CoreProductReviewPaginatedResultSchema,
          ),
          capability: (args) =>
            new FakeProductReviewsCapability(
              args.config,
              args.cache,
              args.context,
              args.factory,
            ),
        },
        buildCapabilityArgs,
      );
    }

    if (caps.productAssociations?.enabled) {
      client.productAssociations = resolveCapabilityWithFactory(
        capabilities.productAssociations,
        {
          factory: new FakeProductAssociationsFactory(CoreProductAssociationSchema),
          capability: (args) =>
            new FakeProductAssociationsCapability(
              args.config,
              args.cache,
              args.context,
              args.factory,
            ),
        },
        buildCapabilityArgs,
      );
    }

    return client;
  };
}
