import { z } from 'zod';

export const CapabilitiesSchema = z.looseObject({
    product: z.boolean(),
    search: z.boolean(),
    analytics: z.boolean(),
    identity: z.boolean(),
    cart: z.boolean(),
    cartPayment: z.boolean(),
    order: z.boolean(),
    orderPayment: z.boolean(),
    inventory: z.boolean(),
    price: z.boolean(),
    category: z.boolean(),
    store: z.boolean()
});

export type Capabilities = z.infer<typeof CapabilitiesSchema>;
