import { CapabilitiesSchema } from "@reactionary/core";
import type { z } from 'zod';

export const AlgoliaCapabilitiesSchema = CapabilitiesSchema.pick({
    product: true,
    productSearch: true,
    analytics: true
}).partial();

export type AlgoliaCapabilities = z.infer<typeof AlgoliaCapabilitiesSchema>;
