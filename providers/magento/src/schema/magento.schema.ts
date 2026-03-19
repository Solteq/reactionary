import { CartIdentifierSchema } from "@reactionary/core";
import { z } from "zod";

export const MagentoCartIdentifierSchema = CartIdentifierSchema.extend({});

export type MagentoCartIdentifier = z.infer<typeof MagentoCartIdentifierSchema>;
