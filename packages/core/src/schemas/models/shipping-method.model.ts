import * as z from "zod";
import { ShippingMethodIdentifierSchema } from "./identifiers.model.js";
import { MonetaryAmountSchema } from "./price.model.js";
import { BaseModelSchema, ImageSchema } from "./base.model.js";
import { AddressSchema } from "./profile.model.js";
import type { InferType } from '../../zod-utils.js';

export const PickupPointSchema = z.looseObject({
    identifier: z.object({
        key: z.string()
    }),
    name: z.string(),
    description: z.string(),
    address: AddressSchema,
    openingHours: z.string().optional().meta({ description: 'The opening hours of the pickup point, if applicable. This could be a string like "Mon-Fri 9am-5pm".' }),
    contactPhone: z.string().optional().meta({ description: 'The contact phone number for the pickup point, if applicable.' }),
    contactEmail: z.string().optional().meta({ description: 'The contact email for the pickup point, if applicable.' }),
    instructions: z.string().optional().meta({ description: 'Any special instructions for picking up from this point.' }),
});

export const ShippingMethodSchema = z.looseObject({
    identifier: ShippingMethodIdentifierSchema,
    name: z.string(),
    description: z.string(),
    logo: ImageSchema.optional(),
    price: MonetaryAmountSchema,
    deliveryTime: z.string(),
    carrier: z.string().optional(),
});

export const ShippingInstructionSchema = BaseModelSchema.extend({
    shippingMethod: ShippingMethodIdentifierSchema,
    pickupPoint: z.string().meta({ description: 'An optional pickup point for the shipping method. This could be a physical store, a locker, or similar. If not set, it means home delivery to the shipping address.' }),
    instructions: z.string().meta({ description: 'Optional instructions for the shipping. This could be delivery instructions, or similar.' }),
    consentForUnattendedDelivery: z.boolean().meta({ description: 'Indicates if the customer has given consent for unattended delivery, if applicable.' }),
});

export type ShippingMethod = InferType<typeof ShippingMethodSchema>;
export type PickupPoint = InferType<typeof PickupPointSchema>;
export type ShippingInstruction = InferType<typeof ShippingInstructionSchema>;
