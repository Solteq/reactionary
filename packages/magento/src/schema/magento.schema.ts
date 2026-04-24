import { CartIdentifierSchema } from "@reactionary/core";
import type * as z from "zod";

export const MagentoCartIdentifierSchema = CartIdentifierSchema.extend({});

export type MagentoCartIdentifier = z.infer<typeof MagentoCartIdentifierSchema>;
