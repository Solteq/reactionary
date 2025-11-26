import { z } from 'zod';
import { PaginationOptionsSchema } from './base.model.js';

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
  key: z.string().describe('The unique identifier for the product attribute.'),
});

export const ProductAttributeValueIdentifierSchema = z.looseObject({
  key: z.string().describe('The unique identifier for the product attribute value.'),
});

export const ProductOptionIdentifierSchema = z.looseObject({
  key: z.string().describe('The unique identifier for the product option.'),
});

export const ProductOptionValueIdentifierSchema = z.looseObject({
  option: ProductOptionIdentifierSchema,
  key: z.string().describe('The value of the product option, e.g., "Red" or "Large".'),
});

export const ProductIdentifierSchema = z.looseObject({
  key: z.string()
});

export const ProductSearchIdentifierSchema = z.looseObject({
  term: z.string(),
  facets: z.array(FacetValueIdentifierSchema),
  filters: z.array(z.string()),
  paginationOptions: PaginationOptionsSchema,
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

export type ProductIdentifier = z.infer<typeof ProductIdentifierSchema>;
export type ProductVariantIdentifier = z.infer<typeof ProductVariantIdentifierSchema>;
export type SearchIdentifier = z.infer<typeof ProductSearchIdentifierSchema>;
export type FacetIdentifier = z.infer<typeof FacetIdentifierSchema>;
export type FacetValueIdentifier = z.infer<typeof FacetValueIdentifierSchema>;
export type CartIdentifier = z.infer<typeof CartIdentifierSchema>;
export type CartItemIdentifier = z.infer<typeof CartItemIdentifierSchema>;
export type PriceIdentifier = z.infer<typeof PriceIdentifierSchema>;
export type CategoryIdentifier = z.infer<typeof CategoryIdentifierSchema>;
export type WebStoreIdentifier = z.infer<typeof WebStoreIdentifierSchema>;
export type InventoryIdentifier = z.infer<typeof InventoryIdentifierSchema>;
export type FulfillmentCenterIdentifier = z.infer<
  typeof FulfillmentCenterIdentifierSchema
>;
export type IdentityIdentifier = z.infer<typeof IdentityIdentifierSchema>;
export type ShippingMethodIdentifier = z.infer<
  typeof ShippingMethodIdentifierSchema
>;
export type PaymentMethodIdentifier = z.infer<
  typeof PaymentMethodIdentifierSchema
>;
export type AddressIdentifier = z.infer<typeof AddressIdentifierSchema>;
export type PaymentInstructionIdentifier = z.infer<
  typeof PaymentInstructionIdentifierSchema
>;
export type OrderIdentifier = z.infer<typeof OrderIdentifierSchema>;
export type OrderItemIdentifier = z.infer<typeof OrderItemIdentifierSchema>;

export type CheckoutIdentifier = z.infer<typeof CheckoutIdentifierSchema>;
export type CheckoutItemIdentifier = z.infer<typeof CheckoutItemIdentifierSchema>;
export type PickupPointIdentifier = z.infer<typeof PickupPointIdentifierSchema>;
export type StoreIdentifier = z.infer<typeof StoreIdentifierSchema>;
export type ProductOptionIdentifier = z.infer<typeof ProductOptionIdentifierSchema>;
export type ProductOptionValueIdentifier = z.infer<typeof ProductOptionValueIdentifierSchema>;
export type ProductAttributeIdentifier = z.infer<typeof ProductAttributeIdentifierSchema>;
export type ProductAttributeValueIdentifier = z.infer<typeof ProductAttributeValueIdentifierSchema>;

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
