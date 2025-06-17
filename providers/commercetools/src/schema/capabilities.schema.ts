import { CapabilitiesSchema } from "@reactionary/core";
import { z } from 'zod';

export const CommercetoolsCapabilitiesSchema = CapabilitiesSchema.pick({
    product: true,
    search: true,
    identity: true,
    cart: true
}).partial();

export type CommercetoolsCapabilities = z.infer<typeof CommercetoolsCapabilitiesSchema>;