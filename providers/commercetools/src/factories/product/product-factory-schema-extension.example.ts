import { ProductSchema } from "@reactionary/core";
import { CommercetoolsProductFactory } from "./product.factory.js";
import * as z from "zod";
import { assertNotAny, assertType } from "./utils.example.js";

const context = {} as any;

const ExtendedProductSchema = ProductSchema.safeExtend({
  extendedValue: z.string(),
});

class ExtendedCommercetoolsProductFactory extends CommercetoolsProductFactory<typeof ExtendedProductSchema> {
  constructor() {
    super(ExtendedProductSchema);
  }
}

const extendedFactory = new ExtendedCommercetoolsProductFactory();
const extendedProduct = extendedFactory.parseProduct(context, {} as any);

assertNotAny(extendedProduct);
assertNotAny(extendedProduct.extendedValue);
assertType<string>(extendedProduct.extendedValue);
