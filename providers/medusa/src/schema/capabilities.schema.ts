import { CapabilitiesSchema } from "@reactionary/core";
import type { z } from 'zod';

export const MedusaCapabilitiesSchema = CapabilitiesSchema.pick({
    productSearch: true,
    cart: true,
    checkout: true,
    category: true,
    product: true,
    price: true,
    inventory: true,
}).partial();

export type MedusaCapabilities = z.infer<typeof MedusaCapabilitiesSchema>;
