import { ProductQueryByIdSchema, ProductSchema } from "@reactionary/core";
import type {
  ProductFactoryOutput,
  ProductQueryById as BaseProductQueryById,
  Result,
} from "@reactionary/core";
import { CommercetoolsProductFactory } from "./product.factory.js";
import { CommercetoolsProductCapability } from "../../capabilities/product.capability.js";
import * as z from "zod";
import { assertNotAny, assertType } from "./utils.example.js";

const cache = {} as any;
const context = {} as any;
const config = {} as any;
const api = {} as any;

const ExtendedProductSchema = ProductSchema.safeExtend({
  extendedValue: z.string(),
});

class ExtendedCommercetoolsProductFactory extends CommercetoolsProductFactory<typeof ExtendedProductSchema> {
  constructor() {
    super(ExtendedProductSchema);
  }
}

const ExtendedProductQueryByIdSchema = ProductQueryByIdSchema.extend({
  auditTrail: z.boolean(),
});
type ExtendedProductQueryById = z.infer<typeof ExtendedProductQueryByIdSchema>;

class ExtendedCommercetoolsProductCapability extends CommercetoolsProductCapability<ExtendedCommercetoolsProductFactory> {
  public override async getById(
    payload: ExtendedProductQueryById
  ) {
    const basePayload: BaseProductQueryById = {
      identifier: payload.identifier,
    };
    return super.getById(basePayload);
  }
}

const extendedCapability = new ExtendedCommercetoolsProductCapability(
  cache,
  context,
  config,
  api,
  new ExtendedCommercetoolsProductFactory()
);

extendedCapability.getById({
  identifier: { key: "p-1" },
  auditTrail: true
}).then((x) => {
  assertNotAny(x);
  if (x.success) {
    assertNotAny(x.value);
    assertNotAny(x.value.extendedValue);
    assertType<string>(x.value.extendedValue);
  }
});
