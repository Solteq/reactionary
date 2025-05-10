import { z } from 'zod';

export const CapabilitiesSchema = z.interface({
    product: z.boolean(),
    search: z.boolean()
});

export type Capabilities = z.infer<typeof CapabilitiesSchema>;