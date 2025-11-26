import { z } from 'zod';
import type { InferType } from '../zod-utils.js';

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

export type Capabilities = InferType<typeof CapabilitiesSchema>;
