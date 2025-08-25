import { z } from 'zod';

export const FacetIdentifierSchema = z.looseInterface({
    key: z.string().default('').nonoptional()
});

export const FacetValueIdentifierSchema = z.looseInterface({
    facet: FacetIdentifierSchema.default(() => FacetIdentifierSchema.parse({})),
    key: z.string().default('')
});

export const SKUIdentifierSchema = z.looseInterface({
    key: z.string().default('').nonoptional()
});

export const ProductIdentifierSchema = z.looseInterface({
    key: z.string().default(''),
});

export const SearchIdentifierSchema = z.looseInterface({
    term: z.string().default(''),
    page: z.number().default(0),
    pageSize: z.number().default(20),
    facets: z.array(FacetValueIdentifierSchema.required()).default(() => [])
});

export const CartIdentifierSchema = z.looseInterface({
    key: z.string().default('')
});

export const CartItemIdentifierSchema = z.looseInterface({
    key: z.string().default('')
});

export const PriceIdentifierSchema = z.looseInterface({
    sku: SKUIdentifierSchema.default(() => SKUIdentifierSchema.parse({})),
});

export type ProductIdentifier = z.infer<typeof ProductIdentifierSchema>;
export type SKUIdentifier = z.infer<typeof SKUIdentifierSchema>;
export type SearchIdentifier = z.infer<typeof SearchIdentifierSchema>;
export type FacetIdentifier = z.infer<typeof FacetIdentifierSchema>;
export type FacetValueIdentifier = z.infer<typeof FacetValueIdentifierSchema>;
export type CartIdentifier = z.infer<typeof CartIdentifierSchema>;
export type CartItemIdentifier = z.infer<typeof CartItemIdentifierSchema>;
export type PriceIdentifier = z.infer<typeof PriceIdentifierSchema>;