import { CapabilitiesSchema } from "@reactionary/core";
import { z } from 'zod';

export const FakeCapabilitiesSchema = CapabilitiesSchema.pick({
    product: true,
    search: true,
    identity: true
}).partial();

export type FakeCapabilities = z.infer<typeof FakeCapabilitiesSchema>;