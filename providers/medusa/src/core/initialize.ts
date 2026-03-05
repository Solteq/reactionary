import type {
  Cache,
  RequestContext,
} from '@reactionary/core';
import {
  CartIdentifierSchema,
  CartSchema,
  CategoryPaginatedResultSchema,
  CategorySchema,
  CheckoutSchema,
  InventorySchema,
  OrderSchema,
  OrderSearchResultSchema,
  PaymentMethodSchema,
  PriceSchema,
  ProductAssociationSchema,
  ProductSchema,
  ProductSearchResultSchema,
  ProfileSchema,
  ShippingMethodSchema,
} from '@reactionary/core';
import { MedusaCartProvider } from '../providers/cart.provider.js';
import { MedusaCategoryProvider } from '../providers/category.provider.js';
import { MedusaCheckoutProvider } from '../providers/checkout.provider.js';
import { MedusaIdentityProvider } from '../providers/identity.provider.js';
import { MedusaInventoryProvider } from '../providers/inventory.provider.js';
import { MedusaOrderSearchProvider } from '../providers/order-search.provider.js';
import { MedusaOrderProvider } from '../providers/order.provider.js';
import { MedusaPriceProvider } from '../providers/price.provider.js';
import { MedusaSearchProvider } from '../providers/product-search.provider.js';
import { MedusaProductRecommendationsProvider } from '../providers/product-recommendations.provider.js';
import { MedusaProductProvider } from '../providers/product.provider.js';
import { MedusaProductAssociationsProvider } from '../providers/product-associations.provider.js';
import { MedusaProfileProvider } from '../providers/profile.provider.js';
import {
  MedusaCapabilitiesSchema,
  type MedusaCapabilities,
} from '../schema/capabilities.schema.js';
import {
  MedusaConfigurationSchema,
  type MedusaConfiguration,
} from '../schema/configuration.schema.js';
import { MedusaAPI } from './client.js';
import {
  MedusaCartFactory,
  MedusaCategoryFactory,
  MedusaCheckoutFactory,
  MedusaInventoryFactory,
  MedusaOrderFactory,
  MedusaOrderSearchFactory,
  MedusaPriceFactory,
  MedusaProductAssociationsFactory,
  MedusaProductFactory,
  MedusaProductSearchFactory,
  MedusaProfileFactory,
} from '../factories/index.js';
import {
  type MedusaClientFromCapabilities,
  resolveCapabilityProvider,
  resolveProviderOnlyCapability,
} from './initialize.types.js';

export function withMedusaCapabilities<T extends MedusaCapabilities>(
  configuration: MedusaConfiguration,
  capabilities: T,
) {
  return (
    cache: Cache,
    context: RequestContext,
  ): MedusaClientFromCapabilities<T> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client: any = {};
    const config = MedusaConfigurationSchema.parse(configuration);
    const caps = MedusaCapabilitiesSchema.parse(capabilities);
    const medusaApi = new MedusaAPI(config, context);

    const buildProviderArgs = <TFactory,>(factory: TFactory) => ({
      cache,
      context,
      config,
      medusaApi,
      factory,
    });

    if (caps.product?.enabled) {
      client.product = resolveCapabilityProvider(
        capabilities.product,
        {
          factory: new MedusaProductFactory(ProductSchema),
          provider: (args) =>
            new MedusaProductProvider(
              args.config,
              args.cache,
              args.context,
              args.medusaApi,
              args.factory,
            ),
        },
        buildProviderArgs,
      );
    }

    if (caps.productSearch?.enabled) {
      client.productSearch = resolveCapabilityProvider(
        capabilities.productSearch,
        {
          factory: new MedusaProductSearchFactory(ProductSearchResultSchema),
          provider: (args) =>
            new MedusaSearchProvider(
              args.config,
              args.cache,
              args.context,
              args.medusaApi,
              args.factory,
            ),
        },
        buildProviderArgs,
      );
    }

    if (caps.category?.enabled) {
      client.category = resolveCapabilityProvider(
        capabilities.category,
        {
          factory: new MedusaCategoryFactory(
            CategorySchema,
            CategoryPaginatedResultSchema,
          ),
          provider: (args) =>
            new MedusaCategoryProvider(
              args.config,
              args.cache,
              args.context,
              args.medusaApi,
              args.factory,
            ),
        },
        buildProviderArgs,
      );
    }

    if (caps.checkout?.enabled) {
      client.checkout = resolveCapabilityProvider(
        capabilities.checkout,
        {
          factory: new MedusaCheckoutFactory(
            CheckoutSchema,
            ShippingMethodSchema,
            PaymentMethodSchema,
          ),
          provider: (args) =>
            new MedusaCheckoutProvider(
              args.config,
              args.cache,
              args.context,
              args.medusaApi,
              args.factory,
            ),
        },
        buildProviderArgs,
      );
    }

    if (caps.productRecommendations?.enabled) {
      client.productRecommendations = resolveProviderOnlyCapability(
        capabilities.productRecommendations,
        (args) =>
          new MedusaProductRecommendationsProvider(
            args.config,
            args.cache,
            args.context,
            args.medusaApi,
          ),
        {
          cache,
          context,
          config,
          medusaApi,
        },
      );
    }

    if (caps.cart?.enabled) {
      client.cart = resolveCapabilityProvider(
        capabilities.cart,
        {
          factory: new MedusaCartFactory(CartSchema, CartIdentifierSchema),
          provider: (args) =>
            new MedusaCartProvider(
              args.config,
              args.cache,
              args.context,
              args.medusaApi,
              args.factory,
            ),
        },
        buildProviderArgs,
      );
    }

    if (caps.price?.enabled) {
      client.price = resolveCapabilityProvider(
        capabilities.price,
        {
          factory: new MedusaPriceFactory(PriceSchema),
          provider: (args) =>
            new MedusaPriceProvider(
              args.config,
              args.cache,
              args.context,
              args.medusaApi,
              args.factory,
            ),
        },
        buildProviderArgs,
      );
    }

    if (caps.inventory?.enabled) {
      client.inventory = resolveCapabilityProvider(
        capabilities.inventory,
        {
          factory: new MedusaInventoryFactory(InventorySchema),
          provider: (args) =>
            new MedusaInventoryProvider(
              args.config,
              args.cache,
              args.context,
              args.medusaApi,
              args.factory,
            ),
        },
        buildProviderArgs,
      );
    }

    if (caps.identity?.enabled) {
      client.identity = resolveProviderOnlyCapability(
        capabilities.identity,
        (args) =>
          new MedusaIdentityProvider(
            args.config,
            args.cache,
            args.context,
            args.medusaApi,
          ),
        {
          cache,
          context,
          config,
          medusaApi,
        },
      );
    }

    if (caps.profile?.enabled) {
      client.profile = resolveCapabilityProvider(
        capabilities.profile,
        {
          factory: new MedusaProfileFactory(ProfileSchema),
          provider: (args) =>
            new MedusaProfileProvider(
              args.config,
              args.cache,
              args.context,
              args.medusaApi,
              args.factory,
            ),
        },
        buildProviderArgs,
      );
    }

    if (caps.order?.enabled) {
      client.order = resolveCapabilityProvider(
        capabilities.order,
        {
          factory: new MedusaOrderFactory(OrderSchema),
          provider: (args) =>
            new MedusaOrderProvider(
              args.config,
              args.cache,
              args.context,
              args.medusaApi,
              args.factory,
            ),
        },
        buildProviderArgs,
      );
    }

    if (caps.orderSearch?.enabled) {
      client.orderSearch = resolveCapabilityProvider(
        capabilities.orderSearch,
        {
          factory: new MedusaOrderSearchFactory(OrderSearchResultSchema),
          provider: (args) =>
            new MedusaOrderSearchProvider(
              args.config,
              args.cache,
              args.context,
              args.medusaApi,
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
          factory: new MedusaProductAssociationsFactory(ProductAssociationSchema),
          provider: (args) =>
            new MedusaProductAssociationsProvider(
              args.config,
              args.cache,
              args.context,
              args.medusaApi,
              args.factory,
            ),
        },
        buildProviderArgs,
      );
    }

    return client;
  };
}
