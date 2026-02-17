import * as z from 'zod';
import { PaginationOptionsSchema } from './base.model.js';
import type { InferType } from '../../zod-utils.js';
export const OrderStatusSchema = z.enum(['AwaitingPayment', 'ReleasedToFulfillment', 'Shipped', 'Cancelled']).meta({ description: 'The current status of the order.' });
export const OrderInventoryStatusSchema = z.enum(['NotAllocated', 'Allocated', 'Backordered', 'Preordered']).meta({ description: 'The inventory release status of the order.' });

export const FacetIdentifierSchema = z.looseObject({
  key: z.string(),
});

export const FacetValueIdentifierSchema = z.object({
  facet: FacetIdentifierSchema,
  key: z.string(),
});

export const ProductVariantIdentifierSchema = z.looseObject({
  sku: z.string(),
});

export const ProductAttributeIdentifierSchema = z.looseObject({
  key: z.string().meta({ description: 'The unique identifier for the product attribute.' }),
});

export const ProductAttributeValueIdentifierSchema = z.looseObject({
  key: z.string().meta({ description: 'The unique identifier for the product attribute value.' }),
});

export const ProductOptionIdentifierSchema = z.looseObject({
  key: z.string().meta({ description: 'The unique identifier for the product option.' }),
});

export const ProductOptionValueIdentifierSchema = z.looseObject({
  option: ProductOptionIdentifierSchema,
  key: z.string().meta({ description: 'The value of the product option, e.g., "Red" or "Large".' }),
});

export const ProductIdentifierSchema = z.looseObject({
  key: z.string()
});


export const CartIdentifierSchema = z.looseObject({
  key: z.string(),
});

export const CartItemIdentifierSchema = z.looseObject({
  key: z.string(),
});

export const PriceIdentifierSchema = z.looseObject({
  variant: ProductVariantIdentifierSchema,
});

export const CategoryIdentifierSchema = z.looseObject({
  key: z.string(),
});

export const StoreIdentifierSchema = z.looseObject({
  key: z.string(),
});

export const OrderIdentifierSchema = z.looseObject({
  key: z.string(),
});

export const OrderItemIdentifierSchema = z.looseObject({
  key: z.string(),
});


export const CheckoutIdentifierSchema = z.looseObject({
    key: z.string(),
});

export const CheckoutItemIdentifierSchema = z.looseObject({
    key: z.string(),
});

/**
 * The target store the user is interacting with. Can change over time, and is not necessarily the same as the default store.
 */
export const WebStoreIdentifierSchema = z.looseObject({
  key: z.string(),
});

export const FulfillmentCenterIdentifierSchema = z.looseObject({
  key: z.string(),
});

export const InventoryIdentifierSchema = z.looseObject({
  variant: ProductVariantIdentifierSchema,
  fulfillmentCenter: FulfillmentCenterIdentifierSchema,
});

export const IdentityIdentifierSchema = z.looseObject({
  userId: z.string(),
});

export const ShippingMethodIdentifierSchema = z.looseObject({
    key: z.string(),
});

export const PaymentMethodIdentifierSchema = z.looseObject({
  method: z.string(),
  name: z.string(),
  paymentProcessor: z.string(),
});

export const AddressIdentifierSchema = z.looseObject({
  nickName: z.string(),
});

export const PaymentInstructionIdentifierSchema = z.looseObject({
  key: z.string(),
});

export const PickupPointIdentifierSchema = z.looseObject({
    key: z.string(),
});

export const ProductRecommendationIdentifierSchema = z.looseObject({
    key: z.string(),
    algorithm: z.string(),
});


export const ProductSearchIdentifierSchema = z.looseObject({
  term: z.string().meta({ description: 'The search term used to find products.' }),
  facets: z.array(FacetValueIdentifierSchema).meta({ description: 'The facets applied to filter the search results.' }),
  filters: z.array(z.string()).meta({ description: 'Additional filters applied to the search results.' }),
  paginationOptions: PaginationOptionsSchema.describe('Pagination options for the search results.'),
  categoryFilter: FacetValueIdentifierSchema.optional().describe('An optional category filter applied to the search results.'),
});

/**
 * Bar
 */
export const OrderSearchIdentifierSchema = z.looseObject({
  term: z.string().meta({ description: 'The search term used to find orders. Not all providers may support term-based search for orders.' }),
  partNumber: z.array(z.string()).optional().meta({ description: 'An optional list part number to filter orders by specific products. Will be ANDed together.' }),
  orderStatus: z.array(OrderStatusSchema).optional().meta({ description: 'An optional list of order statuses to filter the search results.' }),
  user: IdentityIdentifierSchema.optional().describe('An optional user ID to filter orders by specific users. Mostly for b2b usecases with hierachial order access.'),
  startDate: z.string().optional().meta({ description: 'An optional start date to filter orders from a specific date onwards. ISO8601' }),
  endDate: z.string().optional().meta({ description: 'An optional end date to filter orders up to a specific date. ISO8601' }),
  filters: z.array(z.string()).meta({ description: 'Additional filters applied to the search results.' }),
  paginationOptions: PaginationOptionsSchema.describe('Pagination options for the search results.'),
});


export type OrderSearchIdentifier = InferType<typeof OrderSearchIdentifierSchema>;
export type ProductIdentifier = InferType<typeof ProductIdentifierSchema>;
export type ProductVariantIdentifier = InferType<typeof ProductVariantIdentifierSchema>;
export type SearchIdentifier = InferType<typeof ProductSearchIdentifierSchema>;
export type FacetIdentifier = InferType<typeof FacetIdentifierSchema>;
export type FacetValueIdentifier = InferType<typeof FacetValueIdentifierSchema>;
export type CartIdentifier = InferType<typeof CartIdentifierSchema>;
export type CartItemIdentifier = InferType<typeof CartItemIdentifierSchema>;
export type PriceIdentifier = InferType<typeof PriceIdentifierSchema>;
export type CategoryIdentifier = InferType<typeof CategoryIdentifierSchema>;
export type WebStoreIdentifier = InferType<typeof WebStoreIdentifierSchema>;
export type InventoryIdentifier = InferType<typeof InventoryIdentifierSchema>;
export type FulfillmentCenterIdentifier = InferType<
  typeof FulfillmentCenterIdentifierSchema
>;
export type IdentityIdentifier = InferType<typeof IdentityIdentifierSchema>;
export type ShippingMethodIdentifier = InferType<
  typeof ShippingMethodIdentifierSchema
>;
export type PaymentMethodIdentifier = InferType<
  typeof PaymentMethodIdentifierSchema
>;
export type AddressIdentifier = InferType<typeof AddressIdentifierSchema>;
export type PaymentInstructionIdentifier = InferType<
  typeof PaymentInstructionIdentifierSchema
>;
export type OrderIdentifier = InferType<typeof OrderIdentifierSchema>;
export type OrderItemIdentifier = InferType<typeof OrderItemIdentifierSchema>;

export type CheckoutIdentifier = InferType<typeof CheckoutIdentifierSchema>;
export type CheckoutItemIdentifier = InferType<typeof CheckoutItemIdentifierSchema>;
export type PickupPointIdentifier = InferType<typeof PickupPointIdentifierSchema>;
export type StoreIdentifier = InferType<typeof StoreIdentifierSchema>;
export type ProductOptionIdentifier = InferType<typeof ProductOptionIdentifierSchema>;
export type ProductOptionValueIdentifier = InferType<typeof ProductOptionValueIdentifierSchema>;
export type ProductAttributeIdentifier = InferType<typeof ProductAttributeIdentifierSchema>;
export type ProductAttributeValueIdentifier = InferType<typeof ProductAttributeValueIdentifierSchema>;
export type ProductRecommendationIdentifier = InferType<typeof ProductRecommendationIdentifierSchema>;

export type IdentifierType =
  | ProductIdentifier
  | ProductVariantIdentifier
  | SearchIdentifier
  | FacetIdentifier
  | FacetValueIdentifier
  | CartIdentifier
  | CartItemIdentifier
  | PriceIdentifier
  | CategoryIdentifier
  | WebStoreIdentifier
  | InventoryIdentifier
  | ProductRecommendationIdentifier
  | FulfillmentCenterIdentifier
  | IdentityIdentifier
  | ShippingMethodIdentifier
  | PaymentMethodIdentifier
  | AddressIdentifier
  | PaymentInstructionIdentifier
  | OrderIdentifier
  | OrderItemIdentifier
  | CheckoutIdentifier
  | CheckoutItemIdentifier
  | StoreIdentifier
  | ProductOptionIdentifier
  | ProductOptionValueIdentifier
  | PickupPointIdentifier
  | ProductAttributeIdentifier
  | ProductAttributeValueIdentifier;
