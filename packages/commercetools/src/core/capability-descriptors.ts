import {
  CartIdentifierSchema,
  CartSchema,
  CategoryPaginatedResultSchema,
  CategorySchema,
  CheckoutSchema,
  CompanySchema,
  CompanyPaginatedListSchema,
  EmployeeSchema,
  EmployeePaginatedListSchema,
  IdentitySchema,
  InventorySchema,
  OrderSearchResultSchema,
  OrderSchema,
  PaymentMethodSchema,
  ProductAssociationSchema,
  ProductListItemPaginatedResultsSchema,
  ProductListItemSchema,
  ProductListPaginatedResultsSchema,
  ProductListSchema,
  ProductRatingSummarySchema,
  ProductReviewPaginatedResultSchema,
  ProductReviewSchema,
  ProductSchema,
  ProductSearchResultSchema,
  ProfileSchema,
  PriceSchema,
  ShippingMethodSchema,
  StoreSchema,
  type Cache,
  type RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';
import {
  type CommercetoolsCapabilities,
  type CommercetoolsCapabilitiesSchema,
} from '../schema/capabilities.schema.js';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type { CommercetoolsAPI } from './client.js';
import { CommercetoolsCartFactory } from '../factories/cart/cart.factory.js';
import { CommercetoolsCategoryFactory } from '../factories/category/category.factory.js';
import { CommercetoolsCheckoutFactory } from '../factories/checkout/checkout.factory.js';
import { CommercetoolsIdentityFactory } from '../factories/identity/identity.factory.js';
import { CommercetoolsInventoryFactory } from '../factories/inventory/inventory.factory.js';
import { CommercetoolsOrderFactory } from '../factories/order/order.factory.js';
import { CommercetoolsOrderSearchFactory } from '../factories/order-search/order-search.factory.js';
import { CommercetoolsPriceFactory } from '../factories/price/price.factory.js';
import { CommercetoolsProductAssociationsFactory } from '../factories/product-associations/product-associations.factory.js';
import { CommercetoolsProductListFactory } from '../factories/product-list/product-list.factory.js';
import { CommercetoolsProductFactory } from '../factories/product/product.factory.js';
import { CommercetoolsProductReviewsFactory } from '../factories/product-reviews/product-reviews.factory.js';
import { CommercetoolsProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import { CommercetoolsProfileFactory } from '../factories/profile/profile.factory.js';
import { CommercetoolsStoreFactory } from '../factories/store/store.factory.js';
import { CommercetoolsCompanyRegistrationFactory } from '../factories/company-registration/company-registration.factory.js';
import { CommercetoolsCartCapability } from '../capabilities/cart.capability.js';
import { CommercetoolsCategoryCapability } from '../capabilities/category.capability.js';
import { CommercetoolsCheckoutCapability } from '../capabilities/checkout.capability.js';
import { CommercetoolsIdentityCapability } from '../capabilities/identity.capability.js';
import { CommercetoolsInventoryCapability } from '../capabilities/inventory.capability.js';
import { CommercetoolsOrderCapability } from '../capabilities/order.capability.js';
import { CommercetoolsOrderSearchCapability } from '../capabilities/order-search.capability.js';
import { CommercetoolsPriceCapability } from '../capabilities/price.capability.js';
import { CommercetoolsProductAssociationsCapability } from '../capabilities/product-associations.capability.js';
import { CommercetoolsProductListCapability } from '../capabilities/product-list.capability.js';
import { CommercetoolsProductCapability } from '../capabilities/product.capability.js';
import { CommercetoolsProductReviewsCapability } from '../capabilities/product-reviews.capability.js';
import { CommercetoolsProductSearchCapability } from '../capabilities/product-search.capability.js';
import { CommercetoolsProfileCapability } from '../capabilities/profile.capability.js';
import { CommercetoolsStoreCapability } from '../capabilities/store.capability.js';
import { CommercetoolsCompanyRegistrationCapability } from '../capabilities/company-registration.capability.js';
import { CommercetoolsCompanyCapability } from '../capabilities/company.capability.js';
import { CommercetoolsCompanyFactory } from '../factories/company/company.factory.js';
import { CommercetoolsEmployeeFactory } from '../factories/employee/employee.factory.js';
import { CommercetoolsEmployeeCapability } from '../capabilities/employee.capability.js';
import { CommercetoolsEmployeeInvitationCapability } from '../capabilities/employee-invitation.capability.js';
import { CommercetoolsEmployeeInvitationFactory } from '../factories/employee-invitation/employee-invitation.factory.js';

export const capabilityKeys = [
  'product',
  'profile',
  'productSearch',
  'productAssociations',
  'productList',
  'productReviews',
  'identity',
  'cart',
  'inventory',
  'price',
  'category',
  'checkout',
  'store',
  'order',
  'orderSearch',
  'companyRegistration',
  'company',
  'employee',
  'employeeInvitation',
] as const;

export type OverridableCapabilityKey = (typeof capabilityKeys)[number];

type CapabilityArgs<TFactory> = {
  cache: Cache;
  context: RequestContext;
  config: CommercetoolsConfiguration;
  commercetoolsApi: CommercetoolsAPI;
  factory: TFactory;
};

type ParsedCapabilities = z.infer<typeof CommercetoolsCapabilitiesSchema>;

export type CapabilityDescriptor = {
  isEnabled: (caps: ParsedCapabilities) => boolean | undefined;
  getOverride: (caps: CommercetoolsCapabilities) => {
    factory?: any;
    capability?: (args: any) => any;
  } | undefined;
  createDefaultFactory: () => any;
  createDefaultCapability: (args: any) => any;
};

export const capabilityDescriptors: Record<OverridableCapabilityKey, CapabilityDescriptor> = {
  product: {
    isEnabled: (caps) => caps.product?.enabled,
    getOverride: (caps) => caps.product,
    createDefaultFactory: () => new CommercetoolsProductFactory(ProductSchema),
    createDefaultCapability: (args) =>
      new CommercetoolsProductCapability(
        args.cache,
        args.context,
        args.config,
        args.commercetoolsApi,
        args.factory,
      ),
  },
  profile: {
    isEnabled: (caps) => caps.profile?.enabled,
    getOverride: (caps) => caps.profile,
    createDefaultFactory: () => new CommercetoolsProfileFactory(ProfileSchema),
    createDefaultCapability: (args) =>
      new CommercetoolsProfileCapability(
        args.config,
        args.cache,
        args.context,
        args.commercetoolsApi,
        args.factory,
      ),
  },
  productSearch: {
    isEnabled: (caps) => caps.productSearch?.enabled,
    getOverride: (caps) => caps.productSearch,
    createDefaultFactory: () =>
      new CommercetoolsProductSearchFactory(ProductSearchResultSchema),
    createDefaultCapability: (args) =>
      new CommercetoolsProductSearchCapability(
        args.config,
        args.cache,
        args.context,
        args.commercetoolsApi,
        args.factory,
      ),
  },
  productAssociations: {
    isEnabled: (caps) => caps.productAssociations?.enabled,
    getOverride: (caps) => caps.productAssociations,
    createDefaultFactory: () =>
      new CommercetoolsProductAssociationsFactory(ProductAssociationSchema),
    createDefaultCapability: (args) =>
      new CommercetoolsProductAssociationsCapability(
        args.config,
        args.cache,
        args.context,
        args.commercetoolsApi,
        args.factory,
      ),
  },
  productList: {
    isEnabled: (caps) => caps.productList?.enabled,
    getOverride: (caps) => caps.productList,
    createDefaultFactory: () =>
      new CommercetoolsProductListFactory(
        ProductListSchema,
        ProductListItemSchema,
        ProductListPaginatedResultsSchema,
        ProductListItemPaginatedResultsSchema,
      ),
    createDefaultCapability: (args) =>
      new CommercetoolsProductListCapability(
        args.config,
        args.cache,
        args.context,
        args.commercetoolsApi,
        args.factory,
      ),
  },
  productReviews: {
    isEnabled: (caps) => caps.productReviews?.enabled,
    getOverride: (caps) => caps.productReviews,
    createDefaultFactory: () =>
      new CommercetoolsProductReviewsFactory(
        ProductRatingSummarySchema,
        ProductReviewSchema,
        ProductReviewPaginatedResultSchema,
      ),
    createDefaultCapability: (args) =>
      new CommercetoolsProductReviewsCapability(
        args.config,
        args.cache,
        args.context,
        args.commercetoolsApi,
        args.factory,
      ),
  },
  identity: {
    isEnabled: (caps) => caps.identity?.enabled,
    getOverride: (caps) => caps.identity,
    createDefaultFactory: () => new CommercetoolsIdentityFactory(IdentitySchema),
    createDefaultCapability: (args) =>
      new CommercetoolsIdentityCapability(
        args.config,
        args.cache,
        args.context,
        args.commercetoolsApi,
        args.factory,
      ),
  },
  cart: {
    isEnabled: (caps) => caps.cart?.enabled,
    getOverride: (caps) => caps.cart,
    createDefaultFactory: () =>
      new CommercetoolsCartFactory(CartSchema, CartIdentifierSchema),
    createDefaultCapability: (args) =>
      new CommercetoolsCartCapability(
        args.config,
        args.cache,
        args.context,
        args.commercetoolsApi,
        args.factory,
      ),
  },
  inventory: {
    isEnabled: (caps) => caps.inventory?.enabled,
    getOverride: (caps) => caps.inventory,
    createDefaultFactory: () => new CommercetoolsInventoryFactory(InventorySchema),
    createDefaultCapability: (args) =>
      new CommercetoolsInventoryCapability(
        args.config,
        args.cache,
        args.context,
        args.commercetoolsApi,
        args.factory,
      ),
  },
  price: {
    isEnabled: (caps) => caps.price?.enabled,
    getOverride: (caps) => caps.price,
    createDefaultFactory: () => new CommercetoolsPriceFactory(PriceSchema),
    createDefaultCapability: (args) =>
      new CommercetoolsPriceCapability(
        args.config,
        args.cache,
        args.context,
        args.commercetoolsApi,
        args.factory,
      ),
  },
  category: {
    isEnabled: (caps) => caps.category?.enabled,
    getOverride: (caps) => caps.category,
    createDefaultFactory: () =>
      new CommercetoolsCategoryFactory(CategorySchema, CategoryPaginatedResultSchema),
    createDefaultCapability: (args) =>
      new CommercetoolsCategoryCapability(
        args.config,
        args.cache,
        args.context,
        args.commercetoolsApi,
        args.factory,
      ),
  },
  checkout: {
    isEnabled: (caps) => caps.checkout?.enabled,
    getOverride: (caps) => caps.checkout,
    createDefaultFactory: () =>
      new CommercetoolsCheckoutFactory(
        CheckoutSchema,
        ShippingMethodSchema,
        PaymentMethodSchema,
      ),
    createDefaultCapability: (args) =>
      new CommercetoolsCheckoutCapability(
        args.config,
        args.cache,
        args.context,
        args.commercetoolsApi,
        args.factory,
      ),
  },
  store: {
    isEnabled: (caps) => caps.store?.enabled,
    getOverride: (caps) => caps.store,
    createDefaultFactory: () => new CommercetoolsStoreFactory(StoreSchema),
    createDefaultCapability: (args) =>
      new CommercetoolsStoreCapability(
        args.config,
        args.cache,
        args.context,
        args.commercetoolsApi,
        args.factory,
      ),
  },
  order: {
    isEnabled: (caps) => caps.order?.enabled,
    getOverride: (caps) => caps.order,
    createDefaultFactory: () => new CommercetoolsOrderFactory(OrderSchema),
    createDefaultCapability: (args) =>
      new CommercetoolsOrderCapability(
        args.config,
        args.cache,
        args.context,
        args.commercetoolsApi,
        args.factory,
      ),
  },
  orderSearch: {
    isEnabled: (caps) => caps.orderSearch?.enabled,
    getOverride: (caps) => caps.orderSearch,
    createDefaultFactory: () =>
      new CommercetoolsOrderSearchFactory(OrderSearchResultSchema),
    createDefaultCapability: (args) =>
      new CommercetoolsOrderSearchCapability(
        args.config,
        args.cache,
        args.context,
        args.commercetoolsApi,
        args.factory,
      ),
  },
  companyRegistration: {
    isEnabled: (caps) => caps.companyRegistration?.enabled,
    getOverride: (caps) => caps.companyRegistration,
    createDefaultFactory: () =>
      new CommercetoolsCompanyRegistrationFactory(),
    createDefaultCapability: (args) =>
      new CommercetoolsCompanyRegistrationCapability(
        args.config,
        args.cache,
        args.context,
        args.commercetoolsApi,
        args.factory,
      ),
  },
  company: {
    isEnabled: (caps) => caps.company?.enabled,
    getOverride: (caps) => caps.company,
    createDefaultFactory: () =>
      new CommercetoolsCompanyFactory(CompanySchema, CompanyPaginatedListSchema),
    createDefaultCapability: (args) =>
      new CommercetoolsCompanyCapability(
        args.config,
        args.cache,
        args.context,
        args.commercetoolsApi,
        args.factory,
      ),
  },
  employee: {
    isEnabled: (caps) => caps.employee?.enabled,
    getOverride: (caps) => caps.employee,
    createDefaultFactory: () =>
      new CommercetoolsEmployeeFactory(EmployeeSchema, EmployeePaginatedListSchema),
    createDefaultCapability: (args) =>
      new CommercetoolsEmployeeCapability(
        args.config,
        args.cache,
        args.context,
        args.commercetoolsApi,
        args.factory,
      ),
  },
  employeeInvitation: {
    isEnabled: (caps) => caps.employeeInvitation?.enabled,
    getOverride: (caps) => caps.employeeInvitation,
    createDefaultFactory: () =>
      new CommercetoolsEmployeeInvitationFactory(),
    createDefaultCapability: (args) =>
      new CommercetoolsEmployeeInvitationCapability(
        args.config,
        args.cache,
        args.context,
        args.commercetoolsApi,
        args.factory,
      ),
  },
};
