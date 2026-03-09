import { ProductSchema } from "@reactionary/core";
import { CommercetoolsProductFactory } from "./product.factory.js";
import { assertNotAny, assertType } from "./utils.example.js";

const context = {} as any;

const baseFactory = new CommercetoolsProductFactory(ProductSchema);
const baseProduct = baseFactory.parseProduct(context, {} as any);

assertNotAny(baseProduct);
assertNotAny(baseProduct.name);
assertType<string>(baseProduct.name);
// @ts-expect-error base schema does not include extendedValue
assertType<string>(baseProduct.extendedValue);
