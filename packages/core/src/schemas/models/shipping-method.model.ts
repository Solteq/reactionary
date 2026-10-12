import * as z from "zod";
import { ShippingMethodIdentifierSchema, StoreIdentifierSchema } from "./identifiers.model.js";
import { MonetaryAmountSchema } from "./price.model.js";
import { BaseModelSchema, ImageSchema } from "./base.model.js";
import { AddressSchema } from "./profile.model.js";
import type { InferType } from '../../zod-utils.js';

/**
 * How a shipping method fulfills the order:
 * - 'delivery': the order is shipped to an address (home delivery, or delivery to a third-party
 *   carrier service point selected via the shipping instruction's pickupPoint field).
 * - 'pickup': the order is picked up at one of the brand's own stores (BOPIS - buy online, pickup in store).
 */
export const ShippingFulfillmentTypeSchema = z.enum(['delivery', 'pickup']);

/**
 * A single protocol-specific key/value pair exchanged with the shipping provider.
 * The value is either a plain string or a JSON-serializable object, so richer
 * structures (e.g. a selected time slot) round-trip cleanly.
 */
export const ShippingProtocolDataSchema = z.looseObject({
    key: z.string().meta({ description: 'The protocol-specific key, e.g. "timeSlotId".' }),
    value: z.union([z.string(), z.record(z.string(), z.json())]).meta({ description: 'The protocol-specific value: either a plain string, or a JSON-serializable object for richer structures.' }),
});

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
    fulfillmentType: ShippingFulfillmentTypeSchema.optional().meta({ description: 'How this shipping method fulfills the order: "delivery" for shipment to an address (including third-party carrier service points selected via the shipping instruction\'s pickupPoint), "pickup" for collection at one of the brand\'s own stores (BOPIS). When absent, "delivery" can be assumed.' }),
    protocolData: z.array(ShippingProtocolDataSchema).optional().meta({ description: 'Additional provider-populated, protocol-specific data for this shipping method, e.g. available pickup time slots.' }),
});

export const ShippingInstructionSchema = BaseModelSchema.extend({
    shippingMethod: ShippingMethodIdentifierSchema,
    pickupPoint: z.string().meta({ description: 'An optional third-party carrier service point for the shipping method (e.g. a GLS or PostNord parcel shop, or a locker). Reserved for the carrier-service-point case; for pickup at one of the brand\'s own stores (BOPIS), use the store field instead. If neither is set, it means home delivery to the shipping address.' }),
    instructions: z.string().meta({ description: 'Optional instructions for the shipping. This could be delivery instructions, or similar.' }),
    consentForUnattendedDelivery: z.boolean().meta({ description: 'Indicates if the customer has given consent for unattended delivery, if applicable.' }),
    store: StoreIdentifierSchema.optional().meta({ description: 'An optional reference to one of the brand\'s own stores where the order will be picked up (BOPIS). Distinct from pickupPoint, which is reserved for third-party carrier service points.' }),
    protocolData: z.array(ShippingProtocolDataSchema).optional().meta({ description: 'Additional client-set, protocol-specific data for the shipping instruction, e.g. a selected pickup time slot.' }),
});

export type ShippingMethod = InferType<typeof ShippingMethodSchema>;
export type PickupPoint = InferType<typeof PickupPointSchema>;
export type ShippingInstruction = InferType<typeof ShippingInstructionSchema>;
export type ShippingFulfillmentType = InferType<typeof ShippingFulfillmentTypeSchema>;
export type ShippingProtocolData = InferType<typeof ShippingProtocolDataSchema>;
