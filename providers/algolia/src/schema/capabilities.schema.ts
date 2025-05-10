import { CapabilitiesSchema } from "@reactionary/core";
import { z } from 'zod';

export const AlgoliaCapabilitiesSchema = CapabilitiesSchema.pick({
    product: true,
    search: true
}).partial();

export type AlgoliaCapabilities = z.infer<typeof AlgoliaCapabilitiesSchema>;