import { z } from 'zod';

export const CapabilitiesSchema = z.looseInterface({
    product: z.boolean(),
    search: z.boolean(),
    analytics: z.boolean()
});

export type Capabilities = z.infer<typeof CapabilitiesSchema>;