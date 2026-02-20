import * as z from 'zod';
import type { InferType } from '../zod-utils.js';
import type { Client } from '../client/client.js';

export const CapabilitiesSchema = z.looseObject({
    product: z.boolean(),
    productSearch: z.boolean(),
    productAssociations: z.boolean(),
    productRecommendations: z.boolean(),
    productReviews: z.boolean(),
    analytics: z.boolean(),
    identity: z.boolean(),
    cart: z.boolean(),
    checkout: z.boolean(),
    order: z.boolean(),
    orderSearch: z.boolean(),
    inventory: z.boolean(),
    price: z.boolean(),
    category: z.boolean(),
    store: z.boolean(),
    profile: z.boolean()
});

export type Capabilities = InferType<typeof CapabilitiesSchema>;
export type ClientFromCapabilities<C extends Partial<Capabilities>> = {
  [K in keyof C & keyof Client as C[K] extends true ? K : never]: Client[K];
};
