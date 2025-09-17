import { z } from 'zod';

export const FacetIdentifierSchema = z.looseObject({
    key: z.string().default('').nonoptional()
});

export const FacetValueIdentifierSchema = z.looseObject({
    facet: FacetIdentifierSchema.default(() => FacetIdentifierSchema.parse({})),
    key: z.string().default('')
});

export const SKUIdentifierSchema = z.looseObject({
    key: z.string().default('').nonoptional()
});

export const ProductIdentifierSchema = z.looseObject({
    key: z.string().default(''),
});

export const SearchIdentifierSchema = z.looseObject({
    term: z.string().default(''),
    page: z.number().default(0),
    pageSize: z.number().default(20),
    facets: z.array(FacetValueIdentifierSchema.required()).default(() => [])
});

export const CartIdentifierSchema = z.looseObject({
    key: z.string().default('')
});

export const CartItemIdentifierSchema = z.looseObject({
    key: z.string().default('')
});

export const PriceIdentifierSchema = z.looseObject({
    sku: SKUIdentifierSchema.default(() => SKUIdentifierSchema.parse({})),
});

export const CategoryIdentifierSchema = z.looseObject({
  key: z.string().default('').nonoptional()
});

/**
 * The target store the user is interacting with. Can change over time, and is not necessarily the same as the default store.
 */
export const WebStoreIdentifierSchema = z.looseObject({
    key: z.string().default('').nonoptional()
});

export const InventoryChannelIdentifierSchema= z.looseObject({
    key: z.string().default('online').nonoptional()
});

export const InventoryIdentifierSchema = z.looseObject({
    sku: SKUIdentifierSchema.default(() => SKUIdentifierSchema.parse({})),
    channelId: InventoryChannelIdentifierSchema.default(() => InventoryChannelIdentifierSchema.parse({})),
});


export type ProductIdentifier = z.infer<typeof ProductIdentifierSchema>;
export type SearchIdentifier = z.infer<typeof SearchIdentifierSchema>;
export type FacetIdentifier = z.infer<typeof FacetIdentifierSchema>;
export type FacetValueIdentifier = z.infer<typeof FacetValueIdentifierSchema>;
export type CartIdentifier = z.infer<typeof CartIdentifierSchema>;
export type CartItemIdentifier = z.infer<typeof CartItemIdentifierSchema>;
export type PriceIdentifier = z.infer<typeof PriceIdentifierSchema>;
export type CategoryIdentifier = z.infer<typeof CategoryIdentifierSchema>;
export type WebStoreIdentifier = z.infer<typeof WebStoreIdentifierSchema>;
export type InventoryIdentifier = z.infer<typeof InventoryIdentifierSchema>;
export type InventoryChannelIdentifier = z.infer<typeof InventoryChannelIdentifierSchema>;


export type IdentifierType = ProductIdentifier | SearchIdentifier | FacetIdentifier | FacetValueIdentifier | CartIdentifier | CartItemIdentifier | PriceIdentifier | CategoryIdentifier | WebStoreIdentifier | InventoryIdentifier;
