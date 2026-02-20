import { CapabilitiesSchema } from "@reactionary/core";
import type * as z from 'zod';

export const LipscoreCapabilitiesSchema = CapabilitiesSchema.pick({
    productReviews: true,
}).partial();

export type LipscoreCapabilities = z.infer<typeof LipscoreCapabilitiesSchema>;
