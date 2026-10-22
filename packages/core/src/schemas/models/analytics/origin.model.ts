import * as z from 'zod';
import type { InferType } from '../../../zod-utils.js';
import {
    CategoryIdentifierSchema,
    FacetValueIdentifierSchema,
    OrderIdentifierSchema,
    ProductIdentifierSchema,
    ProductListIdentifierSchema,
    ProductRecommendationIdentifierSchema,
    ProductSearchIdentifierSchema,
    PromotionIdentifierSchema,
} from '../identifiers.model.js';

const PositionSchema = z.int().min(0).meta({ description: 'Absolute 0-based index of the item across all pages of the originating list.' });

export const AssociationKindSchema = z.enum(['related', 'cross-sell', 'upsell', 'accessories']).meta({ description: 'The kind of product association the visitor came from.' });
export const CartOriginKindSchema = z.enum(['page', 'mini-cart', 'upsell']).meta({ description: 'Which cart surface the visitor came from.' });
export const QuickOrderKindSchema = z.enum(['sku-entry', 'csv', 'scan']).meta({ description: 'How the items were entered in the quick order flow.' });

export const OriginSearchSchema = z.looseObject({
    type: z.literal('search'),
    identifier: ProductSearchIdentifierSchema.meta({ description: 'The search the visitor came from, including term, facets and paging. Vendor query ids ride on provider subtypes of this identifier.' }),
    position: PositionSchema,
});

export const OriginAutocompleteSchema = z.looseObject({
    type: z.literal('autocomplete'),
    term: z.string().meta({ description: 'The autocomplete term.' }),
    position: PositionSchema,
});

export const OriginCategorySchema = z.looseObject({
    type: z.literal('category'),
    categoryId: CategoryIdentifierSchema,
    filters: z.array(FacetValueIdentifierSchema).default(() => []).meta({ description: 'Facet values active on the category listing.' }),
    position: PositionSchema,
});

export const OriginListSchema = z.looseObject({
    type: z.literal('list'),
    recommendationId: ProductRecommendationIdentifierSchema.optional().meta({ description: 'The recommendation the carousel was built from, if any.' }),
    carouselName: z.string().meta({ description: 'Storefront name of the recommendation or merchandised carousel.' }),
    position: PositionSchema,
});

export const OriginAssociationsSchema = z.looseObject({
    type: z.literal('associations'),
    productId: ProductIdentifierSchema.meta({ description: 'The product whose associations were shown.' }),
    kind: AssociationKindSchema,
    position: PositionSchema,
});

export const OriginProductListSchema = z.looseObject({
    type: z.literal('product-list'),
    listId: ProductListIdentifierSchema,
    position: PositionSchema,
});

export const OriginPromotionSchema = z.looseObject({
    type: z.literal('promotion'),
    promotionId: PromotionIdentifierSchema,
    slot: z.string().meta({ description: 'The placement of the promotion.' }),
});

export const OriginContentSchema = z.looseObject({
    type: z.literal('content'),
    contentId: z.string(),
    slot: z.string().optional(),
});

export const OriginCartSchema = z.looseObject({
    type: z.literal('cart'),
    kind: CartOriginKindSchema.optional(),
});

export const OriginOrderSchema = z.looseObject({
    type: z.literal('order'),
    orderId: OrderIdentifierSchema.meta({ description: 'The order the items were reordered from.' }),
});

export const OriginQuickOrderSchema = z.looseObject({
    type: z.literal('quick-order'),
    kind: QuickOrderKindSchema.optional(),
});

export const OriginDirectSchema = z.looseObject({
    type: z.literal('direct'),
});

// The explicit return type on the getter breaks zod's recursive inference; `Origin` is declared by hand below.
export const OriginPdpSchema = z.looseObject({
    type: z.literal('pdp'),
    get upstream(): z.ZodOptional<z.ZodType<Origin>> {
        return OriginSchema.optional().meta({ description: 'The origin of the visit to the product detail page, so conversions stay attributed to the list that led there.' });
    },
});

export const OriginSchema = z.discriminatedUnion('type', [
    OriginSearchSchema,
    OriginAutocompleteSchema,
    OriginCategorySchema,
    OriginListSchema,
    OriginAssociationsSchema,
    OriginProductListSchema,
    OriginPromotionSchema,
    OriginContentSchema,
    OriginCartSchema,
    OriginOrderSchema,
    OriginQuickOrderSchema,
    OriginPdpSchema,
    OriginDirectSchema,
]).meta({ description: 'Where the visitor encountered the item or surface an event relates to.' });

export type AssociationKind = InferType<typeof AssociationKindSchema>;
export type CartOriginKind = InferType<typeof CartOriginKindSchema>;
export type QuickOrderKind = InferType<typeof QuickOrderKindSchema>;
export type OriginSearch = InferType<typeof OriginSearchSchema>;
export type OriginAutocomplete = InferType<typeof OriginAutocompleteSchema>;
export type OriginCategory = InferType<typeof OriginCategorySchema>;
export type OriginList = InferType<typeof OriginListSchema>;
export type OriginAssociations = InferType<typeof OriginAssociationsSchema>;
export type OriginProductList = InferType<typeof OriginProductListSchema>;
export type OriginPromotion = InferType<typeof OriginPromotionSchema>;
export type OriginContent = InferType<typeof OriginContentSchema>;
export type OriginCart = InferType<typeof OriginCartSchema>;
export type OriginOrder = InferType<typeof OriginOrderSchema>;
export type OriginQuickOrder = InferType<typeof OriginQuickOrderSchema>;
export type OriginDirect = InferType<typeof OriginDirectSchema>;
/** Declared by hand because the schema is recursive. */
export interface OriginPdp {
    type: 'pdp';
    upstream?: Origin | undefined;
}
export type Origin =
    | OriginSearch
    | OriginAutocomplete
    | OriginCategory
    | OriginList
    | OriginAssociations
    | OriginProductList
    | OriginPromotion
    | OriginContent
    | OriginCart
    | OriginOrder
    | OriginQuickOrder
    | OriginPdp
    | OriginDirect;
