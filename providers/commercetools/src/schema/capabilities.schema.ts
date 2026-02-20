import { CapabilitiesSchema } from "@reactionary/core";
import type * as z from 'zod';

export const CommercetoolsCapabilitiesSchema = CapabilitiesSchema.pick({
    product: true,
    productSearch: true,
    productReviews: true,
    identity: true,
    cart: true,
    checkout: true,
    order: true,
    orderSearch: true,
    inventory: true,
    price: true,
    category: true,
    store: true,
    profile: true
}).partial();

export type CommercetoolsCapabilities = z.infer<typeof CommercetoolsCapabilitiesSchema>;
