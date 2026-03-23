import * as z from 'zod';
import type { InferType } from '../../zod-utils.js';
import { CartIdentifierSchema, CartItemIdentifierSchema, CartSearchIdentifierSchema, CompanyIdentifierSchema, IdentityIdentifierSchema, ProductIdentifierSchema, ProductVariantIdentifierSchema } from '../models/identifiers.model.js';
import { BaseModelSchema, createPaginatedResponseSchema } from './base.model.js';
import { CostBreakDownSchema, ItemCostBreakdownSchema } from './cost.model.js';
import { PromotionSchema } from './price.model.js';



export const CartItemSchema = z.looseObject({
    identifier: CartItemIdentifierSchema.default(() => CartItemIdentifierSchema.parse({})),
    product: ProductIdentifierSchema.default(() => ProductIdentifierSchema.parse({})),
    variant: ProductVariantIdentifierSchema.default(() => ProductVariantIdentifierSchema.parse({})),
    quantity: z.number().default(0),
    price: ItemCostBreakdownSchema.default(() => ItemCostBreakdownSchema.parse({})),
});
export const BaseCartSchema = BaseModelSchema.extend({
    identifier: CartIdentifierSchema.default(() => CartIdentifierSchema.parse({})),
    userId: IdentityIdentifierSchema.default(() => IdentityIdentifierSchema.parse({})),
    company: CompanyIdentifierSchema.optional(),
    name: z.string().default(''),
});

export const CartSchema = BaseCartSchema.extend({
    items: z.array(CartItemSchema).default(() => []),
    price: CostBreakDownSchema.default(() => CostBreakDownSchema.parse({})),
    appliedPromotions: z.array(PromotionSchema).default(() => []),
    description: z.string().default(''),
});


export const CartSearchResultItemSchema = BaseCartSchema.extend({
    numItems: z.number().default(0),
    lastModifiedDate: z.string().default(''),
});

export const CartPaginatedSearchResultSchema = createPaginatedResponseSchema(CartSearchResultItemSchema).extend({
    identifier: CartSearchIdentifierSchema,
});


export type CartItem = InferType<typeof CartItemSchema>;
export type Cart = InferType<typeof CartSchema>;
export type CartSearchResultItem = InferType<typeof CartSearchResultItemSchema>;
export type CartPaginatedSearchResult = InferType<typeof CartPaginatedSearchResultSchema>;
