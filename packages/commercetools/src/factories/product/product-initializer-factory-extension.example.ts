import { ProductSchema } from "@reactionary/core";
import { CommercetoolsProductFactory } from "./product.factory.js";
import { withCommercetoolsCapabilities } from "../../core/initialize.js";
import * as z from "zod";
import { assertNotAny, assertType } from "./utils.example.js";

const cache = {} as any;
const context = {} as any;
const config = {} as any;

const ExtendedProductSchema = ProductSchema.safeExtend({
  extendedValue: z.string(),
});

class ExtendedCommercetoolsProductFactory extends CommercetoolsProductFactory<typeof ExtendedProductSchema> {
  constructor() {
    super(ExtendedProductSchema);
  }
}

const capabilityFactory = withCommercetoolsCapabilities(config, {
  product: {
    enabled: true,
    factory: new ExtendedCommercetoolsProductFactory(),
  },
});

const client = capabilityFactory(cache, context);

client.product
  .getById({
    identifier: { key: "p-1" },
  })
  .then((x) => {
    assertNotAny(x);
    if (x.success) {
      assertNotAny(x.value);
      assertNotAny(x.value.extendedValue);
      assertType<string>(x.value.extendedValue);
    }
  });
