import type { ProductListIdentifier, ProductListType } from '@reactionary/core';
import {
  BaseMutationSchema,
  CartIdentifierSchema,
  ProductListIdentifierSchema,
} from '@reactionary/core';
import * as z from 'zod';

/**
 * Raw Magento GraphQL payloads behind the product list capability:
 * - wishlists (`wish` / `favorite`): Magento_WishlistGraphQl, with the Adobe
 *   Commerce multiple-wishlist fields (`name`, `visibility`, create/update/delete);
 * - requisition lists (`requisition`): Adobe Commerce B2B `RequisitionList`.
 *
 * The schemas validate what `graphqlRequest` returns instead of trusting it.
 */

/** Magento GraphQL `ID` values arrive as strings, but older versions emit ints. */
const MagentoIdSchema = z.union([z.string(), z.number()]).transform((value) => String(value));

const MagentoSkuRefSchema = z.looseObject({ sku: z.string() });

export const MagentoSearchResultPageInfoSchema = z.looseObject({
  current_page: z.number().nullish(),
  page_size: z.number().nullish(),
  total_pages: z.number().nullish(),
});

export const MagentoWishlistItemSchema = z.looseObject({
  id: MagentoIdSchema,
  quantity: z.number(),
  description: z.string().nullish(),
  added_at: z.string().nullish(),
  product: MagentoSkuRefSchema.nullish(),
  /** Set on `ConfigurableWishlistItem`: the chosen child (variant) product. */
  configured_variant: MagentoSkuRefSchema.nullish(),
});

export const MagentoWishlistItemsSchema = z.looseObject({
  items: z.array(MagentoWishlistItemSchema.nullable()),
  page_info: MagentoSearchResultPageInfoSchema.nullish(),
});

export const MagentoWishlistSchema = z.looseObject({
  id: MagentoIdSchema,
  name: z.string().nullish(),
  visibility: z.string().nullish(),
  items_count: z.number().nullish(),
  updated_at: z.string().nullish(),
  items_v2: MagentoWishlistItemsSchema.nullish(),
});

export const MagentoRequisitionListItemSchema = z.looseObject({
  uid: z.string(),
  quantity: z.number(),
  product: MagentoSkuRefSchema.nullish(),
});

export const MagentoRequisitionListItemsSchema = z.looseObject({
  items: z.array(MagentoRequisitionListItemSchema.nullable()),
  page_info: MagentoSearchResultPageInfoSchema.nullish(),
  total_pages: z.number().nullish(),
});

export const MagentoRequisitionListSchema = z.looseObject({
  uid: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  items_count: z.number().nullish(),
  updated_at: z.string().nullish(),
  items: MagentoRequisitionListItemsSchema.nullish(),
});

export const MagentoUserErrorSchema = z.looseObject({
  code: z.string().nullish(),
  type: z.string().nullish(),
  message: z.string(),
});

// --- wishlist responses -----------------------------------------------------

export const MagentoCustomerWishlistsResponseSchema = z.looseObject({
  customer: z
    .looseObject({ wishlists: z.array(MagentoWishlistSchema.nullable()) })
    .nullable(),
});

export const MagentoCustomerWishlistResponseSchema = z.looseObject({
  customer: z.looseObject({ wishlist_v2: MagentoWishlistSchema.nullable() }).nullable(),
});

export const MagentoCreateWishlistResponseSchema = z.looseObject({
  createWishlist: z.looseObject({ wishlist: MagentoWishlistSchema }).nullable(),
});

export const MagentoUpdateWishlistResponseSchema = z.looseObject({
  updateWishlist: z.looseObject({ uid: MagentoIdSchema }).nullable(),
});

export const MagentoDeleteWishlistResponseSchema = z.looseObject({
  deleteWishlist: z.looseObject({ status: z.boolean() }).nullable(),
});

const MagentoWishlistMutationOutputSchema = z
  .looseObject({
    wishlist: MagentoWishlistSchema.nullish(),
    user_errors: z.array(MagentoUserErrorSchema).nullish(),
  })
  .nullable();

export const MagentoAddProductsToWishlistResponseSchema = z.looseObject({
  addProductsToWishlist: MagentoWishlistMutationOutputSchema,
});

export const MagentoUpdateProductsInWishlistResponseSchema = z.looseObject({
  updateProductsInWishlist: MagentoWishlistMutationOutputSchema,
});

export const MagentoRemoveProductsFromWishlistResponseSchema = z.looseObject({
  removeProductsFromWishlist: MagentoWishlistMutationOutputSchema,
});

// --- requisition list responses -----------------------------------------------

export const MagentoCustomerRequisitionListsResponseSchema = z.looseObject({
  customer: z
    .looseObject({
      requisition_lists: z
        .looseObject({
          items: z.array(MagentoRequisitionListSchema.nullable()),
          total_count: z.number().nullish(),
          page_info: MagentoSearchResultPageInfoSchema.nullish(),
        })
        .nullable(),
    })
    .nullable(),
});

const MagentoRequisitionListMutationOutputSchema = z
  .looseObject({ requisition_list: MagentoRequisitionListSchema.nullish() })
  .nullable();

/** Item mutations only select the list uid. */
const MagentoRequisitionListRefMutationOutputSchema = z
  .looseObject({ requisition_list: z.looseObject({ uid: z.string() }).nullish() })
  .nullable();

export const MagentoCreateRequisitionListResponseSchema = z.looseObject({
  createRequisitionList: MagentoRequisitionListMutationOutputSchema,
});

export const MagentoUpdateRequisitionListResponseSchema = z.looseObject({
  updateRequisitionList: MagentoRequisitionListMutationOutputSchema,
});

export const MagentoDeleteRequisitionListResponseSchema = z.looseObject({
  deleteRequisitionList: z.looseObject({ status: z.boolean() }).nullable(),
});

export const MagentoAddProductsToRequisitionListResponseSchema = z.looseObject({
  addProductsToRequisitionList: MagentoRequisitionListRefMutationOutputSchema,
});

export const MagentoUpdateRequisitionListItemsResponseSchema = z.looseObject({
  updateRequisitionListItems: MagentoRequisitionListRefMutationOutputSchema,
});

export const MagentoDeleteRequisitionListItemsResponseSchema = z.looseObject({
  deleteRequisitionListItems: MagentoRequisitionListRefMutationOutputSchema,
});

export const MagentoAddRequisitionListItemsToCartResponseSchema = z.looseObject({
  addRequisitionListItemsToCart: z
    .looseObject({
      status: z.boolean(),
      add_requisition_list_items_to_cart_user_errors: z.array(MagentoUserErrorSchema).nullish(),
      cart: z.looseObject({ id: z.string() }).nullish(),
    })
    .nullable(),
});

export const MagentoCustomerCartIdResponseSchema = z.looseObject({
  customerCart: z.looseObject({ id: z.string() }).nullable(),
});

export type MagentoWishlist = z.output<typeof MagentoWishlistSchema>;
export type MagentoWishlistItem = z.output<typeof MagentoWishlistItemSchema>;
export type MagentoRequisitionList = z.output<typeof MagentoRequisitionListSchema>;
export type MagentoRequisitionListItem = z.output<typeof MagentoRequisitionListItemSchema>;
export type MagentoUserError = z.output<typeof MagentoUserErrorSchema>;

// --- factory inputs -----------------------------------------------------------

/**
 * A Magento list as handed to the product list factory. Wishlists don't know
 * whether they were asked for as `wish` or `favorite`, so the requested list
 * type travels with them.
 */
export type MagentoProductListSource =
  | {
      kind: 'wishlist';
      listType: ProductListType;
      userId?: string;
      wishlist: MagentoWishlist;
    }
  | {
      kind: 'requisition';
      userId?: string;
      requisitionList: MagentoRequisitionList;
    };

/**
 * A Magento list item as handed to the factory. Magento keeps no per-item
 * sort order, so `position` (1-based, across the whole list) becomes `order`.
 */
export type MagentoProductListItemSource =
  | {
      kind: 'wishlist';
      list: ProductListIdentifier;
      item: MagentoWishlistItem;
      position: number;
    }
  | {
      kind: 'requisition';
      list: ProductListIdentifier;
      item: MagentoRequisitionListItem;
      position: number;
    };

export interface MagentoProductListPage {
  lists: MagentoProductListSource[];
  totalCount: number;
}

export interface MagentoProductListItemPage {
  items: MagentoProductListItemSource[];
  totalCount: number;
}

// --- Magento-only extension -------------------------------------------------------

/**
 * Input for `MagentoProductListCapability.addListToCart`, which copies a
 * requisition list into the customer's cart (Adobe Commerce B2B
 * `addRequisitionListItemsToCart`). Not part of the core contract.
 */
export const MagentoProductListAddToCartSchema = BaseMutationSchema.extend({
  list: ProductListIdentifierSchema.meta({ description: 'The requisition list to copy into the cart.' }),
  cart: CartIdentifierSchema.optional().meta({
    description:
      "Magento always adds to the signed-in customer's active cart. When given as a masked cart id, it is checked against that cart and a mismatch is rejected.",
  }),
  itemKeys: z.array(z.string()).optional().meta({
    description: 'Requisition list item uids to copy. All items are copied when omitted.',
  }),
});

export type MagentoProductListAddToCart = z.output<typeof MagentoProductListAddToCartSchema>;
