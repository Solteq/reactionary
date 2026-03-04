import * as z from "zod";
import { ProductSchema } from "@reactionary/core";
import { ProductFactory } from "../factories/product.factory.js";
import { CommercetoolsProductProvider } from "../providers/product.provider.js";
import { withCommercetoolsCapabilities } from "../core/initialize.js";

/**
 * DEFAULT
 */
const config = {} as any;
const api = {} as any;
const cache = {} as any;
const context = {} as any;
const defaultFactory = new ProductFactory();

const provider = new CommercetoolsProductProvider(config, cache, context, api, defaultFactory);
const f = await provider.getById({} as any);

if (f.success) {
    console.log(f.value.description);
}

/**
 * FACTORY EXTENSION
 */
export const ExtendedProductSchema = ProductSchema.extend({
    extendedField: z.literal('extended')
})
export class ExtendedProductFactory extends ProductFactory {
    public override readonly schema = ExtendedProductSchema;
}

const extendedFactory = new ExtendedProductFactory();
const providerWithExtendedFactory = new CommercetoolsProductProvider(config, cache, context, api, extendedFactory);
const ff = await providerWithExtendedFactory.getById({} as any);

if (ff.success) {
    console.log(ff.value.extendedField);
}

/**
 * FACTORY EXTENSION THROUGH THE INITIALIZER
 */

const cap = withCommercetoolsCapabilities(
    config,
    { product: true },
    { productFactory: new ExtendedProductFactory() }
);
const capff = await cap(cache, context).product.getById({} as any);

if (capff.success) {
    console.log(capff.value.extendedField);
}
