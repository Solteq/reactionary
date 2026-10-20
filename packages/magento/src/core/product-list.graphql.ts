/**
 * Storefront GraphQL documents for the product list capability. All of them
 * require a customer token: wishlists and requisition lists only exist for
 * signed-in customers, and Magento scopes every lookup to the token's owner.
 *
 * - Wishlists: Magento_WishlistGraphQl. `name`, `visibility` and the
 *   create/update/delete mutations are Adobe Commerce (multiple wishlists).
 * - Requisition lists: Adobe Commerce B2B (Magento_RequisitionListGraphQl).
 */

const WISHLIST_ITEM_FIELDS = `
  id
  quantity
  description
  added_at
  product {
    sku
  }
  ... on ConfigurableWishlistItem {
    configured_variant {
      sku
    }
  }
`;

const WISHLIST_FIELDS = `
  id
  name
  visibility
  items_count
  updated_at
`;

const REQUISITION_LIST_ITEM_FIELDS = `
  uid
  quantity
  product {
    sku
  }
`;

const REQUISITION_LIST_FIELDS = `
  uid
  name
  description
  items_count
  updated_at
`;

// --- wishlists ------------------------------------------------------------------

export const CUSTOMER_WISHLISTS_QUERY = `
  query ReactionaryCustomerWishlists($pageSize: Int!, $currentPage: Int!) {
    customer {
      wishlists(pageSize: $pageSize, currentPage: $currentPage) {
${WISHLIST_FIELDS}
      }
    }
  }
`;

export const CUSTOMER_WISHLIST_QUERY = `
  query ReactionaryCustomerWishlist($id: ID!) {
    customer {
      wishlist_v2(id: $id) {
${WISHLIST_FIELDS}
      }
    }
  }
`;

export const CUSTOMER_WISHLIST_ITEMS_QUERY = `
  query ReactionaryCustomerWishlistItems($id: ID!, $pageSize: Int!, $currentPage: Int!) {
    customer {
      wishlist_v2(id: $id) {
${WISHLIST_FIELDS}
        items_v2(pageSize: $pageSize, currentPage: $currentPage) {
          items {
${WISHLIST_ITEM_FIELDS}
          }
          page_info {
            current_page
            page_size
            total_pages
          }
        }
      }
    }
  }
`;

export const CREATE_WISHLIST_MUTATION = `
  mutation ReactionaryCreateWishlist($input: CreateWishlistInput!) {
    createWishlist(input: $input) {
      wishlist {
${WISHLIST_FIELDS}
      }
    }
  }
`;

export const UPDATE_WISHLIST_MUTATION = `
  mutation ReactionaryUpdateWishlist($wishlistId: ID!, $name: String, $visibility: WishlistVisibilityEnum) {
    updateWishlist(wishlistId: $wishlistId, name: $name, visibility: $visibility) {
      uid
      name
      visibility
    }
  }
`;

export const DELETE_WISHLIST_MUTATION = `
  mutation ReactionaryDeleteWishlist($wishlistId: ID!) {
    deleteWishlist(wishlistId: $wishlistId) {
      status
    }
  }
`;

export const ADD_PRODUCTS_TO_WISHLIST_MUTATION = `
  mutation ReactionaryAddProductsToWishlist($wishlistId: ID!, $wishlistItems: [WishlistItemInput!]!) {
    addProductsToWishlist(wishlistId: $wishlistId, wishlistItems: $wishlistItems) {
      wishlist {
        id
      }
      user_errors {
        code
        message
      }
    }
  }
`;

export const UPDATE_PRODUCTS_IN_WISHLIST_MUTATION = `
  mutation ReactionaryUpdateProductsInWishlist($wishlistId: ID!, $wishlistItems: [WishlistItemUpdateInput!]!) {
    updateProductsInWishlist(wishlistId: $wishlistId, wishlistItems: $wishlistItems) {
      wishlist {
        id
      }
      user_errors {
        code
        message
      }
    }
  }
`;

export const REMOVE_PRODUCTS_FROM_WISHLIST_MUTATION = `
  mutation ReactionaryRemoveProductsFromWishlist($wishlistId: ID!, $wishlistItemsIds: [ID!]!) {
    removeProductsFromWishlist(wishlistId: $wishlistId, wishlistItemsIds: $wishlistItemsIds) {
      wishlist {
        id
      }
      user_errors {
        code
        message
      }
    }
  }
`;

// --- requisition lists ----------------------------------------------------------

export const CUSTOMER_REQUISITION_LISTS_QUERY = `
  query ReactionaryCustomerRequisitionLists($pageSize: Int!, $currentPage: Int!, $filter: RequisitionListFilterInput) {
    customer {
      requisition_lists(pageSize: $pageSize, currentPage: $currentPage, filter: $filter) {
        items {
${REQUISITION_LIST_FIELDS}
        }
        total_count
        page_info {
          current_page
          page_size
          total_pages
        }
      }
    }
  }
`;

export const CUSTOMER_REQUISITION_LIST_ITEMS_QUERY = `
  query ReactionaryCustomerRequisitionListItems($uid: String!, $pageSize: Int!, $currentPage: Int!) {
    customer {
      requisition_lists(pageSize: 1, currentPage: 1, filter: { uids: { eq: $uid } }) {
        items {
${REQUISITION_LIST_FIELDS}
          items(pageSize: $pageSize, currentPage: $currentPage) {
            items {
${REQUISITION_LIST_ITEM_FIELDS}
            }
            page_info {
              current_page
              page_size
              total_pages
            }
            total_pages
          }
        }
        total_count
      }
    }
  }
`;

export const CREATE_REQUISITION_LIST_MUTATION = `
  mutation ReactionaryCreateRequisitionList($input: CreateRequisitionListInput!) {
    createRequisitionList(input: $input) {
      requisition_list {
${REQUISITION_LIST_FIELDS}
      }
    }
  }
`;

export const UPDATE_REQUISITION_LIST_MUTATION = `
  mutation ReactionaryUpdateRequisitionList($requisitionListUid: ID!, $input: UpdateRequisitionListInput!) {
    updateRequisitionList(requisitionListUid: $requisitionListUid, input: $input) {
      requisition_list {
${REQUISITION_LIST_FIELDS}
      }
    }
  }
`;

export const DELETE_REQUISITION_LIST_MUTATION = `
  mutation ReactionaryDeleteRequisitionList($requisitionListUid: ID!) {
    deleteRequisitionList(requisitionListUid: $requisitionListUid) {
      status
    }
  }
`;

export const ADD_PRODUCTS_TO_REQUISITION_LIST_MUTATION = `
  mutation ReactionaryAddProductsToRequisitionList($requisitionListUid: ID!, $requisitionListItems: [RequisitionListItemsInput!]!) {
    addProductsToRequisitionList(requisitionListUid: $requisitionListUid, requisitionListItems: $requisitionListItems) {
      requisition_list {
        uid
      }
    }
  }
`;

export const UPDATE_REQUISITION_LIST_ITEMS_MUTATION = `
  mutation ReactionaryUpdateRequisitionListItems($requisitionListUid: ID!, $requisitionListItems: [UpdateRequisitionListItemsInput!]!) {
    updateRequisitionListItems(requisitionListUid: $requisitionListUid, requisitionListItems: $requisitionListItems) {
      requisition_list {
        uid
      }
    }
  }
`;

export const DELETE_REQUISITION_LIST_ITEMS_MUTATION = `
  mutation ReactionaryDeleteRequisitionListItems($requisitionListUid: ID!, $requisitionListItemUids: [ID!]!) {
    deleteRequisitionListItems(requisitionListUid: $requisitionListUid, requisitionListItemUids: $requisitionListItemUids) {
      requisition_list {
        uid
      }
    }
  }
`;

export const ADD_REQUISITION_LIST_ITEMS_TO_CART_MUTATION = `
  mutation ReactionaryAddRequisitionListItemsToCart($requisitionListUid: ID!, $requisitionListItemUids: [ID!]) {
    addRequisitionListItemsToCart(requisitionListUid: $requisitionListUid, requisitionListItemUids: $requisitionListItemUids) {
      status
      add_requisition_list_items_to_cart_user_errors {
        message
        type
      }
      cart {
        id
      }
    }
  }
`;

export const CUSTOMER_CART_ID_QUERY = `
  query ReactionaryCustomerCartId {
    customerCart {
      id
    }
  }
`;
