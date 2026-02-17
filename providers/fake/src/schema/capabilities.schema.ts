import { CapabilitiesSchema } from "@reactionary/core";
import type * as z from 'zod';

export const FakeCapabilitiesSchema = CapabilitiesSchema.pick({
    product: true,
    productSearch: true,
    identity: true,
    category: true,
    cart: true,
    inventory: true,
    store: true,
    price: true,
    checkout: true,
    order: true,
    orderSearch: true,
    profile: true,    
}).partial();

export type FakeCapabilities = z.infer<typeof FakeCapabilitiesSchema>;
