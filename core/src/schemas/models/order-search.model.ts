import * as z from "zod";
import { BaseModelSchema, createPaginatedResponseSchema } from "./base.model.js";
import { IdentityIdentifierSchema, OrderIdentifierSchema, OrderInventoryStatusSchema, OrderSearchIdentifierSchema, OrderStatusSchema } from "./identifiers.model.js";
import type { InferType } from "../../zod-utils.js";
import { MonetaryAmountSchema } from "./price.model.js";
import { AddressSchema } from "./profile.model.js";


export const OrderSearchResultItemSchema = BaseModelSchema.extend({
    identifier: OrderIdentifierSchema,
    userId: IdentityIdentifierSchema,
    customerName: z.string(),
    shippingAddress: AddressSchema.optional(),
    orderDate: z.string(),
    orderStatus: OrderStatusSchema,
    inventoryStatus: OrderInventoryStatusSchema,
    totalAmount: MonetaryAmountSchema
});



export const OrderSearchResultSchema = createPaginatedResponseSchema(OrderSearchResultItemSchema).extend({
    identifier: OrderSearchIdentifierSchema,
});


export type OrderSearchResult = InferType<typeof OrderSearchResultSchema>;
export type OrderSearchResultItem = InferType<typeof OrderSearchResultItemSchema>;
