import { CapabilitiesSchema } from "@reactionary/core";
import type { z } from 'zod';

export const AlgoliaCapabilitiesSchema = CapabilitiesSchema.pick({
    productSearch: true,
    analytics: true
}).partial();

export type AlgoliaCapabilities = z.infer<typeof AlgoliaCapabilitiesSchema>;
