import { CapabilitiesSchema } from "@reactionary/core";
import type { z } from 'zod';

export const FakeCapabilitiesSchema = CapabilitiesSchema.pick({
    product: true,
    search: true,
    identity: true,
    category: true,
    cart: true,
    inventory: true,
    store: true,
    price: true,
}).partial();

export type FakeCapabilities = z.infer<typeof FakeCapabilitiesSchema>;
