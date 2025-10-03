import { CapabilitiesSchema } from "@reactionary/core";
import type { z } from 'zod';

export const CommercetoolsCapabilitiesSchema = CapabilitiesSchema.pick({
    product: true,
    search: true,
    identity: true,
    cart: true,
    cartPayment: true,
    inventory: true,
    price: true,
    category: true,
    store: true,
}).partial();

export type CommercetoolsCapabilities = z.infer<typeof CommercetoolsCapabilitiesSchema>;
