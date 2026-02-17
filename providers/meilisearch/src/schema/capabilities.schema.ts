import { CapabilitiesSchema } from "@reactionary/core";
import type * as z from 'zod';

export const MeilisearchCapabilitiesSchema = CapabilitiesSchema.pick({
    productSearch: true,
    productRecommendations: true,
    orderSearch: true,
    analytics: true
}).partial();

export type MeilisearchCapabilities = z.infer<typeof MeilisearchCapabilitiesSchema>;
