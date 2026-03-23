import type {
  Cache,
  RequestContext,
} from '@reactionary/core';
import {
  CartIdentifierSchema,
  CartPaginatedSearchResultSchema,
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
import { MedusaCartCapability } from '../capabilities/cart.capability.js';
import { MedusaCategoryCapability } from '../capabilities/category.capability.js';
import { MedusaCheckoutCapability } from '../capabilities/checkout.capability.js';
import { MedusaIdentityCapability } from '../capabilities/identity.capability.js';
import { MedusaInventoryCapability } from '../capabilities/inventory.capability.js';
import { MedusaOrderSearchCapability } from '../capabilities/order-search.capability.js';
import { MedusaOrderCapability } from '../capabilities/order.capability.js';
import { MedusaPriceCapability } from '../capabilities/price.capability.js';
import { MedusaProductSearchCapability } from '../capabilities/product-search.capability.js';
import { MedusaProductRecommendationsCapability } from '../capabilities/product-recommendations.capability.js';
import { MedusaProductCapability } from '../capabilities/product.capability.js';
import { MedusaProductAssociationsCapability } from '../capabilities/product-associations.capability.js';
import { MedusaProfileCapability } from '../capabilities/profile.capability.js';
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
  resolveCapabilityWithFactory,
  resolveDirectCapability,
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

    const buildCapabilityArgs = <TFactory,>(factory: TFactory) => ({
      cache,
      context,
      config,
      medusaApi,
      factory,
    });

    if (caps.product?.enabled) {
      client.product = resolveCapabilityWithFactory(
        capabilities.product,
        {
          factory: new MedusaProductFactory(ProductSchema),
          capability: (args) =>
            new MedusaProductCapability(
              args.config,
              args.cache,
              args.context,
              args.medusaApi,
              args.factory,
            ),
        },
        buildCapabilityArgs,
      );
    }

    if (caps.productSearch?.enabled) {
      client.productSearch = resolveCapabilityWithFactory(
        capabilities.productSearch,
        {
          factory: new MedusaProductSearchFactory(ProductSearchResultSchema),
          capability: (args) =>
            new MedusaProductSearchCapability(
              args.config,
              args.cache,
              args.context,
              args.medusaApi,
              args.factory,
            ),
        },
        buildCapabilityArgs,
      );
    }

    if (caps.category?.enabled) {
      client.category = resolveCapabilityWithFactory(
        capabilities.category,
        {
          factory: new MedusaCategoryFactory(
            CategorySchema,
            CategoryPaginatedResultSchema,
          ),
          capability: (args) =>
            new MedusaCategoryCapability(
              args.config,
              args.cache,
              args.context,
              args.medusaApi,
              args.factory,
            ),
        },
        buildCapabilityArgs,
      );
    }

    if (caps.checkout?.enabled) {
      client.checkout = resolveCapabilityWithFactory(
        capabilities.checkout,
        {
          factory: new MedusaCheckoutFactory(
            CheckoutSchema,
            ShippingMethodSchema,
            PaymentMethodSchema,
          ),
          capability: (args) =>
            new MedusaCheckoutCapability(
              args.config,
              args.cache,
              args.context,
              args.medusaApi,
              args.factory,
            ),
        },
        buildCapabilityArgs,
      );
    }

    if (caps.productRecommendations?.enabled) {
      client.productRecommendations = resolveDirectCapability(
        capabilities.productRecommendations,
        (args) =>
          new MedusaProductRecommendationsCapability(
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
      client.cart = resolveCapabilityWithFactory(
        capabilities.cart,
        {
          factory: new MedusaCartFactory(
            CartSchema,
            CartIdentifierSchema,
            CartPaginatedSearchResultSchema
          ),
          capability: (args) =>
            new MedusaCartCapability(
              args.config,
              args.cache,
              args.context,
              args.medusaApi,
              args.factory,
            ),
        },
        buildCapabilityArgs,
      );
    }

    if (caps.price?.enabled) {
      client.price = resolveCapabilityWithFactory(
        capabilities.price,
        {
          factory: new MedusaPriceFactory(PriceSchema),
          capability: (args) =>
            new MedusaPriceCapability(
              args.config,
              args.cache,
              args.context,
              args.medusaApi,
              args.factory,
            ),
        },
        buildCapabilityArgs,
      );
    }

    if (caps.inventory?.enabled) {
      client.inventory = resolveCapabilityWithFactory(
        capabilities.inventory,
        {
          factory: new MedusaInventoryFactory(InventorySchema),
          capability: (args) =>
            new MedusaInventoryCapability(
              args.config,
              args.cache,
              args.context,
              args.medusaApi,
              args.factory,
            ),
        },
        buildCapabilityArgs,
      );
    }

    if (caps.identity?.enabled) {
      client.identity = resolveDirectCapability(
        capabilities.identity,
        (args) =>
          new MedusaIdentityCapability(
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
      client.profile = resolveCapabilityWithFactory(
        capabilities.profile,
        {
          factory: new MedusaProfileFactory(ProfileSchema),
          capability: (args) =>
            new MedusaProfileCapability(
              args.config,
              args.cache,
              args.context,
              args.medusaApi,
              args.factory,
            ),
        },
        buildCapabilityArgs,
      );
    }

    if (caps.order?.enabled) {
      client.order = resolveCapabilityWithFactory(
        capabilities.order,
        {
          factory: new MedusaOrderFactory(OrderSchema),
          capability: (args) =>
            new MedusaOrderCapability(
              args.config,
              args.cache,
              args.context,
              args.medusaApi,
              args.factory,
            ),
        },
        buildCapabilityArgs,
      );
    }

    if (caps.orderSearch?.enabled) {
      client.orderSearch = resolveCapabilityWithFactory(
        capabilities.orderSearch,
        {
          factory: new MedusaOrderSearchFactory(OrderSearchResultSchema),
          capability: (args) =>
            new MedusaOrderSearchCapability(
              args.config,
              args.cache,
              args.context,
              args.medusaApi,
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
          factory: new MedusaProductAssociationsFactory(ProductAssociationSchema),
          capability: (args) =>
            new MedusaProductAssociationsCapability(
              args.config,
              args.cache,
              args.context,
              args.medusaApi,
              args.factory,
            ),
        },
        buildCapabilityArgs,
      );
    }

    return client;
  };
}
