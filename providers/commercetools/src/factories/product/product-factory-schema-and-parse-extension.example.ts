import { ProductSchema } from "@reactionary/core";
import type { RequestContext } from "@reactionary/core";
import type { ProductProjection } from "@commercetools/platform-sdk";
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

  public override parseProduct(context: RequestContext, data: ProductProjection) {
    const base = super.parseProduct(context, data);

    // PAIN: Needing the satisfies here - possibly unavoidable
    return {
      ...base,
      extendedValue: "from-parse",
    } satisfies z.output<typeof ExtendedProductSchema>;
  }
}

const extendedFactory = new ExtendedCommercetoolsProductFactory();
const extendedProduct = extendedFactory.parseProduct(context, {} as any);

assertNotAny(extendedProduct);
assertNotAny(extendedProduct.extendedValue);
assertType<string>(extendedProduct.extendedValue);
