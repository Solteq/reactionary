import * as z from 'zod';
import { PaginationOptionsSchema } from './base.model.js';
import type { InferType } from '../../zod-utils.js';
export const OrderStatusSchema = z.enum(['AwaitingPayment', 'ReleasedToFulfillment', 'Shipped', 'Cancelled']).meta({ description: 'The current status of the order.' });
export const OrderInventoryStatusSchema = z.enum(['NotAllocated', 'Allocated', 'Backordered', 'Preordered']).meta({ description: 'The inventory release status of the order.' });
export const ProductListTypeSchema = z.enum(['favorite','wish','requisition','shopping']).meta({ description: 'The type of product list, e.g., "wish" or "favorite".' });
export const EmployeeRoleSchema = z.enum(['admin', 'manager', 'employee']);
/**
 * Status of an employee invitation in the system. This can be used to determine if the invitation is active and allowed to perform certain actions, or if it is pending approval or blocked due to violations of terms of service or other issues.
 */
export const EmployeeInvitationStatusSchema = z.enum(['invited', 'accepted', 'revoked', 'rejected']);

/**
 * Status of a company in the system. This can be used to determine if the company is active and allowed to perform certain actions, or if it is pending approval or blocked due to violations of terms of service or other issues.
 */
export const CompanyRegistrationRequestApprovalStatusSchema = z.enum(['pending', 'approved', 'denied']);




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

export const ProductAssociationsIdentifierSchema = z.looseObject({
    key: z.string(),
});

export const ProductRatingIdentifierSchema = z.looseObject({
  product: ProductIdentifierSchema.meta({ description: 'The product this rating summary is for.' }),
});

export const ProductReviewIdentifierSchema = z.looseObject({
  key: z.string().meta({ description: 'The unique identifier for the product review.' }),
});

/**
 * The structural top level legal entity
 */
export const CompanyIdentifierSchema = z.looseObject({
  /**
   * VAT identifier, used for tax-calculation purposes
   */
    taxIdentifier: z.string().meta({ description: 'The unique identifier for the company. Could technically also be the DUNS identifier' }),
});


export const ProductSearchIdentifierSchema = z.looseObject({
  term: z.string().meta({ description: 'The search term used to find products.' }),
  facets: z.array(FacetValueIdentifierSchema).meta({ description: 'The facets applied to filter the search results.' }),
  filters: z.array(z.string()).meta({ description: 'Additional filters applied to the search results.' }),
  paginationOptions: PaginationOptionsSchema.meta({ description: 'Pagination options for the search results.' }),
  categoryFilter: FacetValueIdentifierSchema.optional().meta({ description: 'An optional category filter applied to the search results.' }),
  company: CompanyIdentifierSchema.optional().meta({ description: 'The identifier for the company to search products within. This can be used to filter products by specific companies, which can be useful for B2B use cases.' }),
});




/**
 * Bar
 */
export const OrderSearchIdentifierSchema = z.looseObject({
  term: z.string().meta({ description: 'The search term used to find orders. Not all providers may support term-based search for orders.' }),
  partNumber: z.array(z.string()).optional().meta({ description: 'An optional list part number to filter orders by specific products. Will be ANDed together.' }),
  orderStatus: z.array(OrderStatusSchema).optional().meta({ description: 'An optional list of order statuses to filter the search results.' }),
  user: IdentityIdentifierSchema.optional().meta({ description: 'An optional user ID to filter orders by specific users. Mostly for b2b usecases with hierachial order access.' }),
  company: CompanyIdentifierSchema.optional().meta({ description: 'The identifier for the company to search orders within. This can be used to filter orders by specific companies, which can be useful for B2B use cases.' }),
  startDate: z.string().optional().meta({ description: 'An optional start date to filter orders from a specific date onwards. ISO8601' }),
  endDate: z.string().optional().meta({ description: 'An optional end date to filter orders up to a specific date. ISO8601' }),
  filters: z.array(z.string()).meta({ description: 'Additional filters applied to the search results.' }),
  paginationOptions: PaginationOptionsSchema.meta({ description: 'Pagination options for the search results.' }),
});


export const ProductListSearchIdentifierSchema = z.looseObject({
  listType: ProductListTypeSchema.meta({ description: 'The type of product list, e.g., "wishlist" or "favorites".' }),
  company: CompanyIdentifierSchema.optional().meta({ description: 'The identifier for the company to search product lists within. This can be used to filter product lists by specific companies, which can be useful for B2B use cases.' }),
  paginationOptions: PaginationOptionsSchema.meta({ description: 'Pagination options for the search results.' }),
});


export const ProductListIdentifierSchema = z.looseObject({
  listType: ProductListTypeSchema.meta({ description: 'The type of product list, e.g., "wish" or "favorite".' }),
  key: z.string().meta({ description: 'The unique identifier for the product list.' }),
});

export const ProductListItemSearchIdentifierSchema = z.looseObject({
  list: ProductListIdentifierSchema.meta({ description: 'The identifier for the product list to query. The provider should return the items in the list that match this identifier. For example, if the identifier is a customer ID, the provider should return the items in the customer\'s wishlist. If the identifier is a session ID, the provider should return the items in the customer\'s current shopping cart. If the identifier is a product ID, the provider should return the items in the product\'s related products list.' }),
  paginationOptions: PaginationOptionsSchema.meta({ description: 'Pagination options for the search results.' }),
});

export const ProductListItemIdentifierSchema = z.looseObject({
  key: z.string().meta({ description: 'The unique identifier for the product list item.' }),
  list: ProductListIdentifierSchema,
});

export const PromotionIdentifierSchema = z.looseObject({
    key: z.string().meta({ description: 'The unique identifier for the promotion.' }),
});


export const CompanyRegistrationRequestIdentifierSchema = z.looseObject({
    key: z.string().meta({ description: 'The unique identifier for the company registration request.' }),
});

export const EmployeeInvitationIdentifierSchema = z.looseObject({
    key: z.string().meta({ description: 'The unique identifier for the company employee invitation.' }),
});

export const EmployeeIdentifierSchema = z.looseObject({
  user: IdentityIdentifierSchema,
  company: CompanyIdentifierSchema,
});

export const CompanySearchIdentifierSchema = z.looseObject({
  paginationOptions: PaginationOptionsSchema.meta({ description: 'Pagination options for the search results.' }),
});

export const EmployeeInvitationSearchIdentifierSchema = z.looseObject({
  company: CompanyIdentifierSchema.optional().meta({ description: 'The identifier for the company to search employee invitations within.' }),
  email: z.email().optional().meta({ description: 'The email of the invited employee to search for.' }),
  paginationOptions: PaginationOptionsSchema.meta({ description: 'Pagination options for the search results.' }),
});

export const EmployeeSearchIdentifierSchema = z.looseObject({
  company: CompanyIdentifierSchema.meta({ description: 'The identifier for the company to search employees within.' }),
  email: z.email().optional().meta({ description: 'The email of the employee to search for.' }),
  firstName: z.string().optional().meta({ description: 'The first name of the employee to search for.' }),
  lastName: z.string().optional().meta({ description: 'The last name of the employee to search for.' }),
  role: EmployeeRoleSchema.optional().meta({ description: 'The role of the employee to search for.' }),
  paginationOptions: PaginationOptionsSchema.meta({ description: 'Pagination options for the search results.' }),
});


export const CartSearchIdentifierSchema = z.looseObject({
  company: CompanyIdentifierSchema.optional().meta({ description: 'The identifier for the company to search carts within. This can be used to filter carts by specific companies, which can be useful for B2B use cases.' }),
  paginationOptions: PaginationOptionsSchema.meta({ description: 'Pagination options for the search results.' }),
});



export type CartSearchIdentifier = InferType<typeof CartSearchIdentifierSchema>;
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
export type CompanyIdentifier = InferType<typeof CompanyIdentifierSchema>;
export type CompanyRegistrationRequestIdentifier = InferType<typeof CompanyRegistrationRequestIdentifierSchema>;


export type CheckoutIdentifier = InferType<typeof CheckoutIdentifierSchema>;
export type CheckoutItemIdentifier = InferType<typeof CheckoutItemIdentifierSchema>;
export type PickupPointIdentifier = InferType<typeof PickupPointIdentifierSchema>;
export type StoreIdentifier = InferType<typeof StoreIdentifierSchema>;
export type ProductOptionIdentifier = InferType<typeof ProductOptionIdentifierSchema>;
export type ProductOptionValueIdentifier = InferType<typeof ProductOptionValueIdentifierSchema>;
export type ProductAttributeIdentifier = InferType<typeof ProductAttributeIdentifierSchema>;
export type ProductAttributeValueIdentifier = InferType<typeof ProductAttributeValueIdentifierSchema>;
export type ProductRecommendationIdentifier = InferType<typeof ProductRecommendationIdentifierSchema>;
export type ProductAssociationsIdentifier = InferType<typeof ProductAssociationsIdentifierSchema>;
export type ProductRatingIdentifier = InferType<typeof ProductRatingIdentifierSchema>;
export type ProductReviewIdentifier = InferType<typeof ProductReviewIdentifierSchema>;
export type ProductListIdentifier = InferType<typeof ProductListIdentifierSchema>;
export type ProductListItemIdentifier = InferType<typeof ProductListItemIdentifierSchema>;
export type ProductListSearchIdentifier = InferType<typeof ProductListSearchIdentifierSchema>;
export type ProductListItemSearchIdentifier = InferType<typeof ProductListItemSearchIdentifierSchema>;
export type ProductListType = InferType<typeof ProductListTypeSchema>;
export type PromotionIdentifier = InferType<typeof PromotionIdentifierSchema>;


export type EmployeeRole = InferType<typeof EmployeeRoleSchema>;
export type EmployeeInvitationStatus = InferType<typeof EmployeeInvitationStatusSchema>;
export type CompanyRegistrationRequestApprovalStatus = InferType<typeof CompanyRegistrationRequestApprovalStatusSchema>;
export type EmployeeIdentifier = InferType<typeof EmployeeIdentifierSchema>;
export type EmployeeSearchIdentifier = InferType<typeof EmployeeSearchIdentifierSchema>;
export type EmployeeInvitationIdentifier = InferType<typeof EmployeeInvitationIdentifierSchema>;
export type EmployeeInvitationSearchIdentifier = InferType<typeof EmployeeInvitationSearchIdentifierSchema>;
export type CompanySearchIdentifier = InferType<typeof CompanySearchIdentifierSchema>;
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
  | CompanyIdentifier
  | CompanyRegistrationRequestIdentifier
  | CheckoutIdentifier
  | CheckoutItemIdentifier
  | StoreIdentifier
  | ProductOptionIdentifier
  | ProductOptionValueIdentifier
  | PickupPointIdentifier
  | ProductAttributeIdentifier
  | ProductAttributeValueIdentifier
  | ProductRatingIdentifier
  | ProductReviewIdentifier
  | ProductAssociationsIdentifier
  | ProductListIdentifier
  | ProductListItemIdentifier
  | ProductListSearchIdentifier
  | PromotionIdentifier

  ;
