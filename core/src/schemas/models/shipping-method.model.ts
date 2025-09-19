import z from "zod";
import { ShippingMethodIdentifier } from "./identifiers.model";
import { MonetaryAmountSchema } from "./price.model";
import { ImageSchema } from "./base.model";

export const ShippingMethodSchema = z.looseObject({
    identifier: ShippingMethodIdentifier.default(() => ShippingMethodIdentifier.parse({})),
    name: z.string().default(''),
    description: z.string().default(''),
    logo: ImageSchema.optional(),
    price: MonetaryAmountSchema.default(() => MonetaryAmountSchema.parse({})),
    deliveryTime: z.string().default(''),
});

