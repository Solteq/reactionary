
import type {
  Cache,
  Checkout,
  RequestContext,
  PaymentMethod,
  ShippingMethod,
  CheckoutMutationInitiateCheckout,
  CheckoutMutationSetShippingAddress,
  CheckoutMutationFinalizeCheckout,
  CheckoutMutationAddPaymentInstruction,
  CheckoutMutationRemovePaymentInstruction,
  CheckoutMutationSetShippingInstruction,
  CheckoutQueryById,
  CheckoutQueryForAvailablePaymentMethods,
  CheckoutQueryForAvailableShippingMethods,
  CheckoutIdentifier,
  Currency,
  ShippingInstruction,
  PaymentInstruction
} from "@reactionary/core";
import { AddressSchema, CheckoutItemSchema, CheckoutProvider, PaymentInstructionIdentifierSchema, PaymentInstructionSchema, PaymentMethodIdentifierSchema, PaymentMethodSchema, ShippingInstructionSchema, ShippingMethodIdentifierSchema, ShippingMethodSchema } from "@reactionary/core";
import type z from "zod";
import { MedusaClient } from "../core/client.js";
import type { MedusaConfiguration } from "../schema/configuration.schema.js";
import createDebug from "debug";
const debug = createDebug('reactionary:medusa:checkout');

export class CheckoutNotReadyForFinalizationError extends Error {
  constructor(public checkoutIdentifier: CheckoutIdentifier) {
    super("Checkout is not ready for finalization. Ensure all required fields are set and valid. " + (checkoutIdentifier ? `Checkout ID: ${JSON.stringify(checkoutIdentifier)}` : ''));
    this.name = "CheckoutNotReadyForFinalizationError";
  }
}


export class MedusaCheckoutProvider<
  T extends Checkout = Checkout
> extends CheckoutProvider<T> {
  public override async initiateCheckoutForCart(payload: CheckoutMutationInitiateCheckout, reqCtx: RequestContext): Promise<T> {
    const client = await new MedusaClient(this.config).getClient(reqCtx);
    // we should eventually copy the cart.... but for now we just continue with the existing one.
    if (debug.enabled) {
      debug(`Initiating checkout for cart with key: ${payload.cart.key}`);
    }
    // zero out existing checkout data?
    const response = await client.store.cart.update(payload.cart.key, {
      billing_address: undefined,
      shipping_address: undefined,
      email: undefined,
    });

    return this.parseSingle(response.cart, reqCtx);
  }
  public override async getById(payload: CheckoutQueryById, reqCtx: RequestContext): Promise<T | null> {
    const client = await new MedusaClient(this.config).getClient(reqCtx);
    const response = await client.store.cart.retrieve(payload.identifier.key);
    return this.parseSingle(response.cart, reqCtx);
  }
  public override async setShippingAddress(payload: CheckoutMutationSetShippingAddress, reqCtx: RequestContext): Promise<T> {
    const client = await new MedusaClient(this.config).getClient(reqCtx);

    const  addressLine = `${payload.shippingAddress.streetAddress[0]} ${payload.shippingAddress.streetNumber || ''}`.trim();
    const response = await client.store.cart.update(payload.checkout.key, {
      shipping_address: {
        address_1: addressLine,
        address_2: payload.shippingAddress.streetAddress?.[1] || '',
        postal_code: payload.shippingAddress.postalCode,
        city: payload.shippingAddress.city,
        country_code: payload.shippingAddress.countryCode,
        first_name: payload.shippingAddress.firstName,
        last_name: payload.shippingAddress.lastName,
      }
    });
    return this.parseSingle(response.cart, reqCtx);
  }

  public override async getAvailableShippingMethods(payload: CheckoutQueryForAvailableShippingMethods, reqCtx: RequestContext): Promise<ShippingMethod[]> {
    const client = await new MedusaClient(this.config).getClient(reqCtx);

    if (debug.enabled) {
      debug(`Fetching available shipping methods for checkout with key: ${payload.checkout.key}`);
    }

    const shippingMethodResponse = await client.store.fulfillment.listCartOptions({
      cart_id: payload.checkout.key
    });

    const shippingMethods: ShippingMethod[] = [];

    for (const sm of shippingMethodResponse.shipping_options) {
      shippingMethods.push(ShippingMethodSchema.parse({
        identifier: ShippingMethodIdentifierSchema.parse({ key: sm.id }),
        name: sm.name,
        description: sm.provider || '',
        price: {
          amount: sm.calculated_price.calculated_amount,
          currency: sm.calculated_price.currency_code as Currency,
        },
      }));
    }

    if (debug.enabled) {
      debug(`Found ${shippingMethods.length} shipping methods for checkout with key: ${payload.checkout.key}`, shippingMethods);
    }
    return shippingMethods;
  }

  public override async getAvailablePaymentMethods(payload: CheckoutQueryForAvailablePaymentMethods, reqCtx: RequestContext): Promise<PaymentMethod[]> {
    const client = await new MedusaClient(this.config).getClient(reqCtx);

    if (debug.enabled) {
      debug(`Fetching available payment methods for checkout with key: ${payload.checkout.key}`);
    }
    const paymentMethodResponse = await client.store.payment.listPaymentProviders();

    const paymentMethods: PaymentMethod[] = [];

    for (const pm of paymentMethodResponse.payment_providers) {
      paymentMethods.push(PaymentMethodSchema.parse({
        identifier: PaymentMethodIdentifierSchema.parse({ method: pm.id, name: pm.id, processor: pm.id }),
        logo: '',
        name: pm.id
      }));
    }

    if (debug.enabled) {
      debug(`Found ${paymentMethods.length} payment methods for checkout with key: ${payload.checkout.key}`, paymentMethods);
    }

    return paymentMethods;
  }

  public override async addPaymentInstruction(payload: CheckoutMutationAddPaymentInstruction, reqCtx: RequestContext): Promise<T> {
    const client = await new MedusaClient(this.config).getClient(reqCtx);

    if (debug.enabled) {
      debug(`Adding payment instruction ${payload.paymentInstruction.paymentMethod.name} to checkout with key: ${payload.checkout.key}`);
    }

    throw new Error("Method not implemented.");
  }
  public override removePaymentInstruction(payload: CheckoutMutationRemovePaymentInstruction, reqCtx: RequestContext): Promise<T> {
    throw new Error("Method not implemented.");
  }
  public override setShippingInstruction(payload: CheckoutMutationSetShippingInstruction, reqCtx: RequestContext): Promise<T> {
    throw new Error("Method not implemented.");
  }
  public override finalizeCheckout(payload: CheckoutMutationFinalizeCheckout, reqCtx: RequestContext): Promise<T> {
    throw new Error("Method not implemented.");
  }
  protected override getResourceName(): string {
    throw new Error("Method not implemented.");
  }
  protected config: MedusaConfiguration;

  constructor(config: MedusaConfiguration, schema: z.ZodType<T>, cache: Cache) {
    super(schema, cache);
    this.config = config;
  }



}
