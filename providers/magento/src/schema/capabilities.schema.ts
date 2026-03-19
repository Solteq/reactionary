import { CapabilitiesSchema } from "@reactionary/core";
import type { z } from 'zod';

export const MagentoCapabilitiesSchema = CapabilitiesSchema.pick({
  product: true,
  productSearch: true,
  category: true,
  inventory: true,
  price: true,
  identity: true,
}).partial();

export type MagentoCapabilities = z.infer<typeof MagentoCapabilitiesSchema>;
