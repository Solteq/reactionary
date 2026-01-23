import { CapabilitiesSchema } from "@reactionary/core";
import type { z } from 'zod';

export const MeilisearchCapabilitiesSchema = CapabilitiesSchema.pick({
    productSearch: true,
    analytics: true
}).partial();

export type MeilisearchCapabilities = z.infer<typeof MeilisearchCapabilitiesSchema>;
