import { CartIdentifierSchema, InventoryQueryBySKUSchema } from "@reactionary/core";
import type * as z from "zod";

export const MagentoCartIdentifierSchema = CartIdentifierSchema.extend({});

export type MagentoCartIdentifier = z.infer<typeof MagentoCartIdentifierSchema>;

export const MagentoInventoryQueryBySKUAcrossFulfillmentCentersSchema = InventoryQueryBySKUSchema.omit({
  fulfilmentCenter: true,
});

export type MagentoInventoryQueryBySKUAcrossFulfillmentCenters = z.infer<
  typeof MagentoInventoryQueryBySKUAcrossFulfillmentCentersSchema
>;
