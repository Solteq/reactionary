import { CapabilitiesSchema } from "@reactionary/core";
import type { z } from 'zod';

export const MedusaCapabilitiesSchema = CapabilitiesSchema.pick({
    productSearch: true,
    cart: true,
    product: true,
}).partial();

export type MedusaCapabilities = z.infer<typeof MedusaCapabilitiesSchema>;
