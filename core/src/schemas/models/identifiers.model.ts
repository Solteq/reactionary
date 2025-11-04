import { z } from 'zod';
import { PaginationOptionsSchema } from './base.model.js';

export const FacetIdentifierSchema = z.looseObject({
  key: z.string().default('').nonoptional(),
});

export const FacetValueIdentifierSchema = z.object({
  facet: FacetIdentifierSchema.default(() => FacetIdentifierSchema.parse({})),
  key: z.string().default(''),
});

export const ProductVariantIdentifierSchema = z.looseObject({
  sku: z.string().default('').nonoptional(),
});

export const ProductAttributeIdentifierSchema = z.looseObject({
  key: z.string().default('').describe('The unique identifier for the product attribute.'),
});

export const ProductAttributeValueIdentifierSchema = z.looseObject({
  key: z.string().default('').describe('The unique identifier for the product attribute value.'),
});


export const ProductOptionIdentifierSchema = z.looseObject({
  key: z.string().default('').describe('The unique identifier for the product option.'),
});

export const ProductOptionValueIdentifierSchema = z.looseObject({
  option: ProductOptionIdentifierSchema.default(() => ProductOptionIdentifierSchema.parse({})),
  key: z.string().default('').describe('The value of the product option, e.g., "Red" or "Large".'),
});



export const ProductIdentifierSchema = z.looseObject({
  key: z.string().default(''),
});

export const ProductSearchIdentifierSchema = z.looseObject({
  term: z.string().default(''),
  facets: z.array(FacetValueIdentifierSchema.required()).default(() => []),
  filters: z.array(z.string()).default(() => []),
  paginationOptions: PaginationOptionsSchema.default(() => PaginationOptionsSchema.parse({})),
});

export const CartIdentifierSchema = z.looseObject({
  key: z.string().default(''),
});

export const CartItemIdentifierSchema = z.looseObject({
  key: z.string().default(''),
});

export const PriceIdentifierSchema = z.looseObject({
  variant: ProductVariantIdentifierSchema.default(() => ProductVariantIdentifierSchema.parse({})),
});

export const CategoryIdentifierSchema = z.looseObject({
  key: z.string().default('').nonoptional(),
});

export const StoreIdentifierSchema = z.looseObject({
  key: z.string().default('').optional(),
});

export const OrderIdentifierSchema = z.looseObject({
  key: z.string().default('').nonoptional(),
});

export const OrderItemIdentifierSchema = z.looseObject({
  key: z.string().default('').nonoptional(),
});


export const CheckoutIdentifierSchema = z.looseObject({
    key: z.string().default('').nonoptional()
});

export const CheckoutItemIdentifierSchema = z.looseObject({
    key: z.string().default('').nonoptional()
});

/**
 * The target store the user is interacting with. Can change over time, and is not necessarily the same as the default store.
 */
export const WebStoreIdentifierSchema = z.looseObject({
  key: z.string().default('').nonoptional(),
});

export const FulfillmentCenterIdentifierSchema = z.looseObject({
  key: z.string().default('').nonoptional(),
});

export const InventoryIdentifierSchema = z.looseObject({
  variant: ProductVariantIdentifierSchema.default(() => ProductVariantIdentifierSchema.parse({})),
  fulfillmentCenter: FulfillmentCenterIdentifierSchema.default(() =>
    FulfillmentCenterIdentifierSchema.parse({})
  ),
});

export const IdentityIdentifierSchema = z.looseObject({
  userId: z.string().default('').nonoptional(),
});

export const ShippingMethodIdentifierSchema = z.looseObject({
    key: z.string().default('').nonoptional(),
});


export const PaymentMethodIdentifierSchema = z.looseObject({
  method: z.string().default('').nonoptional(),
  name: z.string().default('').nonoptional(),
  paymentProcessor: z.string().default('').nonoptional(),
});

export const AddressIdentifierSchema = z.looseObject({
  nickName: z.string().default('').nonoptional(),
});

export const PaymentInstructionIdentifierSchema = z.looseObject({
  key: z.string().default('').nonoptional(),
});

export const PickupPointIdentifierSchema = z.looseObject({
    key: z.string().default('').nonoptional()
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
