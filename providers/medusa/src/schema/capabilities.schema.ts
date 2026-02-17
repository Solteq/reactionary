import { CapabilitiesSchema } from "@reactionary/core";
import type * as z from 'zod';

export const MedusaCapabilitiesSchema = CapabilitiesSchema.pick({
    productSearch: true,
    productRecommendations: true,
    cart: true,
    checkout: true,
    category: true,
    product: true,
    price: true,
    order: true,
    orderSearch: true,
    inventory: true,
    identity: true,
    profile: true
}).partial();

export type MedusaCapabilities = z.infer<typeof MedusaCapabilitiesSchema>;
