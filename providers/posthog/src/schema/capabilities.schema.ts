import { CapabilitiesSchema } from "@reactionary/core";
import { z } from 'zod';

export const PosthogCapabilitiesSchema = CapabilitiesSchema.pick({
    analytics: true
}).partial();

export type PosthogCapabilities = z.infer<typeof PosthogCapabilitiesSchema>;