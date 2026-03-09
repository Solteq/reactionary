import type { InferType } from "../../zod-utils.js";
import { OrderSearchIdentifierSchema } from "../models/identifiers.model.js";
import { BaseQuerySchema } from "./base.query.js";

/**
 * Foo
 */
export const OrderSearchQueryByTermSchema = BaseQuerySchema.extend({
    search: OrderSearchIdentifierSchema
});


export type OrderSearchQueryByTerm = InferType<typeof OrderSearchQueryByTermSchema>;
