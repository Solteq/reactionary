import type {
  CartFactory,
  CartFactoryWithOutput,
  CartCapability,
  CategoryFactory,
  CategoryFactoryWithOutput,
  CategoryCapability,
  IdentityCapability,
  InventoryFactory,
  InventoryFactoryWithOutput,
  InventoryCapability,
  PriceFactory,
  PriceFactoryWithOutput,
  PriceCapability,
  ProductFactory,
  ProductFactoryWithOutput,
  ProductCapability,
  ProductSearchFactory,
  ProductSearchFactoryWithOutput,
  ProductSearchCapability,
  ProfileFactory,
  ProfileFactoryWithOutput,
  ProfileCapability,
  OrderSearchFactory,
  OrderSearchFactoryWithOutput,
  OrderSearchCapability,
  OrderFactory,
  OrderFactoryWithOutput,
  OrderCapability,
  CheckoutFactory,
  CheckoutFactoryWithOutput,
  CheckoutCapability,
  ProductAssociationsFactory,
  ProductAssociationsFactoryWithOutput,
  ProductAssociationsCapability,
  ProductRecommendationsCapability,
  ProductReviewsFactory,
  ProductReviewsFactoryWithOutput,
  ProductReviewsCapability,
  ProductListFactory,
  ProductListFactoryWithOutput,
  ProductListCapability,
  StoreFactory,
  StoreFactoryWithOutput,
  StoreCapability,
  PersonalizationProfileFactory,
  PersonalizationProfileFactoryWithOutput,
  PersonalizationProfileCapability,
  CompanyFactory,
  CompanyFactoryWithOutput,
  CompanyCapability,
  CompanyRegistrationFactory,
  CompanyRegistrationFactoryWithOutput,
  CompanyRegistrationCapability,
  EmployeeFactory,
  EmployeeFactoryWithOutput,
  EmployeeCapability,
  EmployeeInvitationFactory,
  EmployeeInvitationFactoryWithOutput,
  EmployeeInvitationCapability,
  RequestContext,
  Cache,
} from '@reactionary/core';
import { CapabilitiesSchema } from '@reactionary/core';
import type { MagentoConfiguration } from './configuration.schema.js';
import type { MagentoClient } from '../core/client.js';
import * as z from 'zod';

const OverridableCapabilitySchema = z.looseObject({
  enabled: z.boolean(),
  factory: z.unknown().optional(),
  capability: z.unknown().optional(),
});

const DirectCapabilitySchema = z.looseObject({
  enabled: z.boolean(),
  capability: z.unknown().optional(),
});

export const MagentoCapabilitiesSchema = CapabilitiesSchema.pick({
  product: true,
  productSearch: true,
  category: true,
  inventory: true,
  price: true,
  identity: true,
  cart: true,
  profile: true,
  orderSearch: true,
  order: true,
  checkout: true,
  productAssociations: true,
  productRecommendations: true,
  productReviews: true,
  productList: true,
  store: true,
  personalizationProfile: true,
  company: true,
})
  .extend({
    product: OverridableCapabilitySchema.optional(),
    productSearch: OverridableCapabilitySchema.optional(),
    cart: OverridableCapabilitySchema.optional(),
    category: OverridableCapabilitySchema.optional(),
    price: OverridableCapabilitySchema.optional(),
    inventory: OverridableCapabilitySchema.optional(),
    identity: DirectCapabilitySchema.optional(),
    profile: OverridableCapabilitySchema.optional(),
    orderSearch: OverridableCapabilitySchema.optional(),
    order: OverridableCapabilitySchema.optional(),
    checkout: OverridableCapabilitySchema.optional(),
    productAssociations: OverridableCapabilitySchema.optional(),
    productRecommendations: DirectCapabilitySchema.optional(),
    productReviews: OverridableCapabilitySchema.optional(),
    productList: OverridableCapabilitySchema.optional(),
    store: OverridableCapabilitySchema.optional(),
    personalizationProfile: OverridableCapabilitySchema.optional(),
    company: OverridableCapabilitySchema.optional(),
    companyRegistration: OverridableCapabilitySchema.optional(),
    employee: OverridableCapabilitySchema.optional(),
    employeeInvitation: OverridableCapabilitySchema.optional(),
  })
  .partial();

export interface MagentoCapabilityFactoryArgs {
  cache: Cache;
  context: RequestContext;
  config: MagentoConfiguration;
  magentoApi: MagentoClient;
}

export interface MagentoFactoryCapabilityArgs<TFactory>
  extends MagentoCapabilityFactoryArgs {
  factory: TFactory;
}

export interface MagentoCapabilityConfig<TFactory, TCapability> {
  enabled: boolean;
  factory?: TFactory;
  capability?: (args: MagentoFactoryCapabilityArgs<TFactory>) => TCapability;
}

export interface MagentoDirectCapabilityConfig<TCapability> {
  enabled: boolean;
  capability?: (args: MagentoCapabilityFactoryArgs) => TCapability;
}

export type MagentoProductCapabilityConfig = MagentoCapabilityConfig<
  ProductFactoryWithOutput<ProductFactory>,
  ProductCapability
>;

export type MagentoProductSearchCapabilityConfig = MagentoCapabilityConfig<
  ProductSearchFactoryWithOutput<ProductSearchFactory>,
  ProductSearchCapability
>;

export type MagentoCartCapabilityConfig = MagentoCapabilityConfig<
  CartFactoryWithOutput<CartFactory>,
  CartCapability
>;

export type MagentoCategoryCapabilityConfig = MagentoCapabilityConfig<
  CategoryFactoryWithOutput<CategoryFactory>,
  CategoryCapability
>;

export type MagentoPriceCapabilityConfig = MagentoCapabilityConfig<
  PriceFactoryWithOutput<PriceFactory>,
  PriceCapability
>;

export type MagentoInventoryCapabilityConfig = MagentoCapabilityConfig<
  InventoryFactoryWithOutput<InventoryFactory>,
  InventoryCapability
>;

export type MagentoIdentityCapabilityConfig =
  MagentoDirectCapabilityConfig<IdentityCapability>;

export type MagentoProfileCapabilityConfig = MagentoCapabilityConfig<
  ProfileFactoryWithOutput<ProfileFactory>,
  ProfileCapability
>;

export type MagentoOrderSearchCapabilityConfig = MagentoCapabilityConfig<
  OrderSearchFactoryWithOutput<OrderSearchFactory>,
  OrderSearchCapability
>;

export type MagentoOrderCapabilityConfig = MagentoCapabilityConfig<
  OrderFactoryWithOutput<OrderFactory>,
  OrderCapability
>;

export type MagentoCheckoutCapabilityConfig = MagentoCapabilityConfig<
  CheckoutFactoryWithOutput<CheckoutFactory>,
  CheckoutCapability
>;

export type MagentoProductAssociationsCapabilityConfig = MagentoCapabilityConfig<
  ProductAssociationsFactoryWithOutput<ProductAssociationsFactory>,
  ProductAssociationsCapability
>;

export type MagentoProductRecommendationsCapabilityConfig =
  MagentoDirectCapabilityConfig<ProductRecommendationsCapability>;

export type MagentoProductReviewsCapabilityConfig = MagentoCapabilityConfig<
  ProductReviewsFactoryWithOutput<ProductReviewsFactory>,
  ProductReviewsCapability
>;

export type MagentoProductListCapabilityConfig = MagentoCapabilityConfig<
  ProductListFactoryWithOutput<ProductListFactory>,
  ProductListCapability
>;

export type MagentoStoreCapabilityConfig = MagentoCapabilityConfig<
  StoreFactoryWithOutput<StoreFactory>,
  StoreCapability
>;

export type MagentoPersonalizationProfileCapabilityConfig = MagentoCapabilityConfig<
  PersonalizationProfileFactoryWithOutput<PersonalizationProfileFactory>,
  PersonalizationProfileCapability
>;

export type MagentoCompanyCapabilityConfig = MagentoCapabilityConfig<
  CompanyFactoryWithOutput<CompanyFactory>,
  CompanyCapability
>;

export type MagentoCompanyRegistrationCapabilityConfig = MagentoCapabilityConfig<
  CompanyRegistrationFactoryWithOutput<CompanyRegistrationFactory>,
  CompanyRegistrationCapability
>;

export type MagentoEmployeeCapabilityConfig = MagentoCapabilityConfig<
  EmployeeFactoryWithOutput<EmployeeFactory>,
  EmployeeCapability
>;

export type MagentoEmployeeInvitationCapabilityConfig = MagentoCapabilityConfig<
  EmployeeInvitationFactoryWithOutput<EmployeeInvitationFactory>,
  EmployeeInvitationCapability
>;

export type MagentoCapabilities<
  TProductFactory extends ProductFactory = ProductFactory,
  TProductCapability extends ProductCapability = ProductCapability,
  TProductSearchFactory extends ProductSearchFactory = ProductSearchFactory,
  TProductSearchCapability extends ProductSearchCapability = ProductSearchCapability,
  TCartFactory extends CartFactory = CartFactory,
  TCartCapability extends CartCapability = CartCapability,
  TCategoryFactory extends CategoryFactory = CategoryFactory,
  TCategoryCapability extends CategoryCapability = CategoryCapability,
  TPriceFactory extends PriceFactory = PriceFactory,
  TPriceCapability extends PriceCapability = PriceCapability,
  TInventoryFactory extends InventoryFactory = InventoryFactory,
  TInventoryCapability extends InventoryCapability = InventoryCapability,
  TIdentityCapability extends IdentityCapability = IdentityCapability,
  TProfileFactory extends ProfileFactory = ProfileFactory,
  TProfileCapability extends ProfileCapability = ProfileCapability,
  TOrderSearchFactory extends OrderSearchFactory = OrderSearchFactory,
  TOrderSearchCapability extends OrderSearchCapability = OrderSearchCapability,
  TOrderFactory extends OrderFactory = OrderFactory,
  TOrderCapability extends OrderCapability = OrderCapability,
  TCheckoutFactory extends CheckoutFactory = CheckoutFactory,
  TCheckoutCapability extends CheckoutCapability = CheckoutCapability,
  TProductAssociationsFactory extends ProductAssociationsFactory = ProductAssociationsFactory,
  TProductAssociationsCapability extends ProductAssociationsCapability = ProductAssociationsCapability,
  TProductRecommendationsCapability extends ProductRecommendationsCapability = ProductRecommendationsCapability,
  TProductReviewsFactory extends ProductReviewsFactory = ProductReviewsFactory,
  TProductReviewsCapability extends ProductReviewsCapability = ProductReviewsCapability,
  TProductListFactory extends ProductListFactory = ProductListFactory,
  TProductListCapability extends ProductListCapability = ProductListCapability,
  TStoreFactory extends StoreFactory = StoreFactory,
  TStoreCapability extends StoreCapability = StoreCapability,
  TPersonalizationProfileFactory extends PersonalizationProfileFactory = PersonalizationProfileFactory,
  TPersonalizationProfileCapability extends PersonalizationProfileCapability = PersonalizationProfileCapability,
  TCompanyFactory extends CompanyFactory = CompanyFactory,
  TCompanyCapability extends CompanyCapability = CompanyCapability,
  TCompanyRegistrationFactory extends CompanyRegistrationFactory = CompanyRegistrationFactory,
  TCompanyRegistrationCapability extends CompanyRegistrationCapability = CompanyRegistrationCapability,
  TEmployeeFactory extends EmployeeFactory = EmployeeFactory,
  TEmployeeCapability extends EmployeeCapability = EmployeeCapability,
  TEmployeeInvitationFactory extends EmployeeInvitationFactory = EmployeeInvitationFactory,
  TEmployeeInvitationCapability extends EmployeeInvitationCapability = EmployeeInvitationCapability,
> = {
  product?: MagentoCapabilityConfig<ProductFactoryWithOutput<TProductFactory>, TProductCapability>;
  productSearch?: MagentoCapabilityConfig<ProductSearchFactoryWithOutput<TProductSearchFactory>, TProductSearchCapability>;
  cart?: MagentoCapabilityConfig<CartFactoryWithOutput<TCartFactory>, TCartCapability>;
  category?: MagentoCapabilityConfig<CategoryFactoryWithOutput<TCategoryFactory>, TCategoryCapability>;
  price?: MagentoCapabilityConfig<PriceFactoryWithOutput<TPriceFactory>, TPriceCapability>;
  inventory?: MagentoCapabilityConfig<InventoryFactoryWithOutput<TInventoryFactory>, TInventoryCapability>;
  identity?: MagentoDirectCapabilityConfig<TIdentityCapability>;
  profile?: MagentoCapabilityConfig<ProfileFactoryWithOutput<TProfileFactory>, TProfileCapability>;
  orderSearch?: MagentoCapabilityConfig<OrderSearchFactoryWithOutput<TOrderSearchFactory>, TOrderSearchCapability>;
  order?: MagentoCapabilityConfig<OrderFactoryWithOutput<TOrderFactory>, TOrderCapability>;
  checkout?: MagentoCapabilityConfig<CheckoutFactoryWithOutput<TCheckoutFactory>, TCheckoutCapability>;
  productAssociations?: MagentoCapabilityConfig<ProductAssociationsFactoryWithOutput<TProductAssociationsFactory>, TProductAssociationsCapability>;
  productRecommendations?: MagentoDirectCapabilityConfig<TProductRecommendationsCapability>;
  productReviews?: MagentoCapabilityConfig<ProductReviewsFactoryWithOutput<TProductReviewsFactory>, TProductReviewsCapability>;
  productList?: MagentoCapabilityConfig<ProductListFactoryWithOutput<TProductListFactory>, TProductListCapability>;
  store?: MagentoCapabilityConfig<StoreFactoryWithOutput<TStoreFactory>, TStoreCapability>;
  personalizationProfile?: MagentoCapabilityConfig<PersonalizationProfileFactoryWithOutput<TPersonalizationProfileFactory>, TPersonalizationProfileCapability>;
  company?: MagentoCapabilityConfig<CompanyFactoryWithOutput<TCompanyFactory>, TCompanyCapability>;
  companyRegistration?: MagentoCapabilityConfig<CompanyRegistrationFactoryWithOutput<TCompanyRegistrationFactory>, TCompanyRegistrationCapability>;
  employee?: MagentoCapabilityConfig<EmployeeFactoryWithOutput<TEmployeeFactory>, TEmployeeCapability>;
  employeeInvitation?: MagentoCapabilityConfig<EmployeeInvitationFactoryWithOutput<TEmployeeInvitationFactory>, TEmployeeInvitationCapability>;
};
