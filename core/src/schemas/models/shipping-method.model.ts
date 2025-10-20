import { z } from "zod";
import { ShippingMethodIdentifierSchema } from "./identifiers.model.js";
import { MonetaryAmountSchema } from "./price.model.js";
import { BaseModelSchema, ImageSchema } from "./base.model.js";
import { AddressSchema } from "./profile.model.js";




export const PickupPointSchema = z.looseObject({
    identifier: z.object({
        key: z.string().default('').nonoptional()
    }).default(() => ({ key: '' })),
    name: z.string().default(''),
    description: z.string().default(''),
    address: AddressSchema.default(() => AddressSchema.parse({})),
    openingHours: z.string().default('').optional().describe('The opening hours of the pickup point, if applicable. This could be a string like "Mon-Fri 9am-5pm".'),
    contactPhone: z.string().default('').optional().describe('The contact phone number for the pickup point, if applicable.'),
    contactEmail: z.string().default('').optional().describe('The contact email for the pickup point, if applicable.'),
    instructions: z.string().default('').optional().describe('Any special instructions for picking up from this point.'),
});


export const ShippingMethodSchema = z.looseObject({
    identifier: ShippingMethodIdentifierSchema.default(() => ShippingMethodIdentifierSchema.parse({})),
    name: z.string().default(''),
    description: z.string().default(''),
    logo: ImageSchema.optional(),
    price: MonetaryAmountSchema.default(() => MonetaryAmountSchema.parse({})),
    deliveryTime: z.string().default(''),
    carrier: z.string().default('').optional(),
});


export const ShippingInstructionSchema = BaseModelSchema.extend({
    shippingMethod: ShippingMethodIdentifierSchema.default(() => ShippingMethodIdentifierSchema.parse({})),
    pickupPoint: z.string().default('').describe('An optional pickup point for the shipping method. This could be a physical store, a locker, or similar. If not set, it means home delivery to the shipping address.'),
    instructions: z.string().default('').describe('Optional instructions for the shipping. This could be delivery instructions, or similar.'),
    consentForUnattendedDelivery: z.boolean().default(false).describe('Indicates if the customer has given consent for unattended delivery, if applicable.'),
});


export type ShippingMethod = z.infer<typeof ShippingMethodSchema>;
export type PickupPoint = z.infer<typeof PickupPointSchema>;
export type ShippingInstruction = z.infer<typeof ShippingInstructionSchema>;
