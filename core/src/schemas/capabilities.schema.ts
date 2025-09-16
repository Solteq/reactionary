import { z } from 'zod';

export const CapabilitiesSchema = z.looseInterface({
    product: z.boolean(),
    search: z.boolean(),
    analytics: z.boolean(),
    identity: z.boolean(),
    cart: z.boolean(),
    inventory: z.boolean(),
    price: z.boolean(),
    category: z.boolean()
});

export type Capabilities = z.infer<typeof CapabilitiesSchema>;
