import { z } from 'zod';

export const CapabilitiesSchema = z.looseObject({
    product: z.boolean(),
    productSearch: z.boolean(),
    analytics: z.boolean(),
    identity: z.boolean(),
    cart: z.boolean(),
    checkout: z.boolean(),
    order: z.boolean(),
    inventory: z.boolean(),
    price: z.boolean(),
    category: z.boolean(),
    store: z.boolean(),
    profile: z.boolean()
});

export type Capabilities = z.infer<typeof CapabilitiesSchema>;
