import type { StoreAddCartShippingMethods, StoreInitializePaymentSession, StoreUpdateCart } from '@medusajs/types';
import type {
  Address,
  Cache,
  CheckoutFactory,
  CheckoutFactoryCheckoutOutput,
  CheckoutFactoryPaymentMethodOutput,
  CheckoutFactoryShippingMethodOutput,
  CheckoutFactoryWithOutput,
  CheckoutIdentifier,
  CheckoutMutationAddPaymentInstruction,
  CheckoutMutationFinalizeCheckout,
  CheckoutMutationInitiateCheckout,
  CheckoutMutationRemovePaymentInstruction,
  CheckoutMutationSetShippingAddress,
  CheckoutMutationSetShippingInstruction,
  CheckoutQueryById,
  CheckoutQueryForAvailablePaymentMethods,
  CheckoutQueryForAvailableShippingMethods,
  Currency,
  MonetaryAmount,
  NotFoundError,
  PaymentMethod,
  RequestContext,
  Result,
  ShippingMethod
} from '@reactionary/core';
import {
  CheckoutCapability,
  CheckoutMutationAddPaymentInstructionSchema,
  CheckoutMutationFinalizeCheckoutSchema,
  CheckoutMutationInitiateCheckoutSchema,
  CheckoutMutationRemovePaymentInstructionSchema,
  CheckoutMutationSetShippingAddressSchema,
  CheckoutMutationSetShippingInstructionSchema,
  CheckoutQueryByIdSchema,
  CheckoutQueryForAvailablePaymentMethodsSchema,
  CheckoutQueryForAvailableShippingMethodsSchema,
  CheckoutSchema,
  MonetaryAmountSchema,
  PaymentMethodSchema,
  Reactionary,
  ShippingMethodIdentifierSchema,
  ShippingMethodSchema,
  success
} from '@reactionary/core';
import createDebug from 'debug';
import * as z from 'zod';
import type { MedusaAPI } from '../core/client.js';
import type { MedusaCheckoutFactory } from '../factories/checkout/checkout.factory.js';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import {
  type MedusaCartIdentifier
} from '../schema/medusa.schema.js';
import { handleProviderError } from '../utils/medusa-helpers.js';
const debug = createDebug('reactionary:medusa:checkout');

export class CheckoutNotReadyForFinalizationError extends Error {



  constructor(public checkoutIdentifier: CheckoutIdentifier) {
    super(
      'Checkout is not ready for finalization. Ensure all required fields are set and valid. ' +
        (checkoutIdentifier
          ? `Checkout ID: ${JSON.stringify(checkoutIdentifier)}`
          : '')
    );
    this.name = 'CheckoutNotReadyForFinalizationError';
  }
}

export class MedusaCheckoutCapability<
  TFactory extends CheckoutFactory = MedusaCheckoutFactory,
> extends CheckoutCapability<
  CheckoutFactoryCheckoutOutput<TFactory>,
  CheckoutFactoryShippingMethodOutput<TFactory>,
  CheckoutFactoryPaymentMethodOutput<TFactory>
> {
  protected config: MedusaConfiguration;
  protected factory: CheckoutFactoryWithOutput<TFactory>;

  /**
   * This controls which fields are always included when fetching a cart
   * You can override this in a subclass to add more fields as needed.
   *
   * example: this.includedFields = [includedFields, '+discounts.*'].join(',');
   */
  protected includedFields: string = ['+items.*'].join(',');



  constructor(
    config: MedusaConfiguration,
    cache: Cache,
    context: RequestContext,
    public medusaApi: MedusaAPI,
    factory: CheckoutFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
  }

  protected initiateCheckoutForCartPayload(payload: CheckoutMutationInitiateCheckout): StoreUpdateCart {
    return {
        billing_address: payload.billingAddress
          ? this.mapAddressToStoreAddress(payload.billingAddress)
          : undefined,
        shipping_address: payload.billingAddress
          ? this.mapAddressToStoreAddress(payload.billingAddress)
          : undefined,
        email: payload.notificationEmail,
        metadata: {
          sms_notification: payload.notificationPhone,
        },
      }
  }

  @Reactionary({
    inputSchema: CheckoutMutationInitiateCheckoutSchema,
    outputSchema: CheckoutSchema,
  })
  public override async initiateCheckoutForCart(
    payload: CheckoutMutationInitiateCheckout
  ): Promise<Result<CheckoutFactoryCheckoutOutput<TFactory>>> {
    const client = await this.medusaApi.getClient();
    // we should eventually copy the cart.... but for now we just continue with the existing one.
    if (debug.enabled) {
      debug(
        `Initiating checkout for cart with key: ${payload.cart.identifier.key}`
      );
    }
    // zero out existing checkout data?
    const response = await client.store.cart.update(
      payload.cart.identifier.key,
      this.initiateCheckoutForCartPayload(payload),
      {
        fields: this.includedFields,
      }
    );

    return success(this.factory.parseCheckout(this.context, response.cart));
  }

  @Reactionary({
    inputSchema: CheckoutQueryByIdSchema,
    outputSchema: CheckoutSchema.nullable(),
  })
  public override async getById(
    payload: CheckoutQueryById
  ): Promise<Result<CheckoutFactoryCheckoutOutput<TFactory>, NotFoundError>> {
    const client = await this.medusaApi.getClient();
    const response = await client.store.cart.retrieve(payload.identifier.key, {
      fields: this.includedFields,
    });
    return success(this.factory.parseCheckout(this.context, response.cart));
  }


  protected setShippingAddressPayload(payload: CheckoutMutationSetShippingAddress): StoreUpdateCart {
    return {
      shipping_address: this.mapAddressToStoreAddress(payload.shippingAddress),
    }
  }

  @Reactionary({
    inputSchema: CheckoutMutationSetShippingAddressSchema,
    outputSchema: CheckoutSchema,
  })
  public override async setShippingAddress(
    payload: CheckoutMutationSetShippingAddress
  ): Promise<Result<CheckoutFactoryCheckoutOutput<TFactory>>> {
    const client = await this.medusaApi.getClient();

    const response = await client.store.cart.update(
      payload.checkout.key,
      this.setShippingAddressPayload(payload),
      {
        fields: this.includedFields,
      },
    );
    return success(this.factory.parseCheckout(this.context, response.cart));
  }


  protected getAvailableShippingMethodsPayload(payload: CheckoutQueryForAvailableShippingMethods) {
    return {
      cart_id: payload.checkout.key,
    }
  }

  @Reactionary({
    inputSchema: CheckoutQueryForAvailableShippingMethodsSchema,
    outputSchema: z.array(ShippingMethodSchema),
  })
  public override async getAvailableShippingMethods(
    payload: CheckoutQueryForAvailableShippingMethods
  ): Promise<Result<CheckoutFactoryShippingMethodOutput<TFactory>[]>> {
    const client = await this.medusaApi.getClient();

    if (debug.enabled) {
      debug(
        `Fetching available shipping methods for checkout with key: ${payload.checkout.key}`
      );
    }

    const shippingMethodResponse =
      await client.store.fulfillment.listCartOptions(
        this.getAvailableShippingMethodsPayload(payload)
      );

    const shippingMethods = [];

    for (const sm of shippingMethodResponse.shipping_options) {
      shippingMethods.push(this.factory.parseShippingMethod(this.context, sm));
    }

    if (debug.enabled) {
      debug(
        `Found ${shippingMethods.length} shipping methods for checkout with key: ${payload.checkout.key}`,
        shippingMethods
      );
    }
    return success(
      shippingMethods
    );
  }

  protected getAvailablePaymentMethodsPayload(payload: CheckoutQueryForAvailablePaymentMethods, regionId: string) {
    return {
      region_id: regionId,
    }
  }

  @Reactionary({
    inputSchema: CheckoutQueryForAvailablePaymentMethodsSchema,
    outputSchema: z.array(PaymentMethodSchema),
  })
  public override async getAvailablePaymentMethods(
    payload: CheckoutQueryForAvailablePaymentMethods
  ): Promise<Result<CheckoutFactoryPaymentMethodOutput<TFactory>[]>> {
    const client = await this.medusaApi.getClient();

    if (debug.enabled) {
      debug(
        `Fetching available payment methods for checkout with key: ${payload.checkout.key}`
      );
    }
    const checkout = await client.store.cart.retrieve(payload.checkout.key);
    const paymentMethodResponse =
      await client.store.payment.listPaymentProviders(
        this.getAvailablePaymentMethodsPayload(
          payload,
          checkout.cart.region_id || (await this.medusaApi.getActiveRegion()).id
        )
      );

    const paymentMethods = [];

    for (const pm of paymentMethodResponse.payment_providers) {
      const payMethod = this.factory.parsePaymentMethod(this.context, pm);

      paymentMethods.push(payMethod);
    }

    if (debug.enabled) {
      debug(
        `Found ${paymentMethods.length} payment methods for checkout with key: ${payload.checkout.key}`,
        paymentMethods
      );
    }

    return success(paymentMethods);
  }


  protected addPaymentInstructionPayload(payload: CheckoutMutationAddPaymentInstruction): StoreInitializePaymentSession {
    return {
          provider_id: payload.paymentInstruction.paymentMethod.method,
          data: payload.paymentInstruction.protocolData.reduce((acc, curr) => {
            acc[curr.key] = curr.value;
            return acc;
          }, {} as Record<string, string>),
        };
  }


  @Reactionary({
    inputSchema: CheckoutMutationAddPaymentInstructionSchema,
    outputSchema: CheckoutSchema,
  })
  public override async addPaymentInstruction(
    payload: CheckoutMutationAddPaymentInstruction
  ): Promise<Result<CheckoutFactoryCheckoutOutput<TFactory>>> {
    const client = await this.medusaApi.getClient();

    if (debug.enabled) {
      debug(
        `Adding payment instruction ${payload.paymentInstruction.paymentMethod.name} to checkout with key: ${payload.checkout.key}`
      );
    }
    try {
      const cartResponse = await client.store.cart.retrieve(
        payload.checkout.key
      );

      const paymentSessionResponse =
        await client.store.payment.initiatePaymentSession(cartResponse.cart, this.addPaymentInstructionPayload(payload));

      const updatedCartResponse = await client.store.cart.retrieve(
        payload.checkout.key,
        {
          fields: this.includedFields,
        }
      );

      return success(this.factory.parseCheckout(this.context, updatedCartResponse.cart));
    } catch (error) {
      debug('Failed to add payment instruction: {0}', [error]);
      throw new Error(
        `Failed to add payment instruction: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  @Reactionary({
    inputSchema: CheckoutMutationRemovePaymentInstructionSchema,
    outputSchema: CheckoutSchema,
  })
  public override removePaymentInstruction(
    payload: CheckoutMutationRemovePaymentInstruction
  ): Promise<Result<CheckoutFactoryCheckoutOutput<TFactory>>> {
    throw new Error('Method not implemented.');
  }

  protected setShippingInstructionPayload(payload: CheckoutMutationSetShippingInstruction): StoreAddCartShippingMethods {
    return {
          option_id: payload.shippingInstruction.shippingMethod.key,
          data: {
            consent_for_unattended_delivery:
              payload.shippingInstruction.consentForUnattendedDelivery + '',
            instructions: payload.shippingInstruction.instructions || '',
          },
        };
  }

  @Reactionary({
    inputSchema: CheckoutMutationSetShippingInstructionSchema,
    outputSchema: CheckoutSchema,
  })
  public override async setShippingInstruction(
    payload: CheckoutMutationSetShippingInstruction
  ): Promise<Result<CheckoutFactoryCheckoutOutput<TFactory>>> {
    const client = await this.medusaApi.getClient();
    const medusaId = payload.checkout as MedusaCartIdentifier;
    try {
      // Set shipping method
      if (payload.shippingInstruction.shippingMethod) {
        await client.store.cart.addShippingMethod(medusaId.key, this.setShippingInstructionPayload(payload));
      }

      // for now, we store a backup of the shipping instruction in metadata
      await client.store.cart.update(medusaId.key, {
        metadata: {
          consent_for_unattended_delivery:
            payload.shippingInstruction.consentForUnattendedDelivery + '',
          instructions: payload.shippingInstruction.instructions || '',
          pickup_point: payload.shippingInstruction.pickupPoint || '',
        },
      });

      // Get updated cart
      const response = await client.store.cart.retrieve(medusaId.key, {
        fields: this.includedFields,
      });

      if (response.cart) {
          return success(this.factory.parseCheckout(this.context, response.cart));
      }

      throw new Error('Failed to set shipping method');
    } catch (error) {
      handleProviderError('set shipping method', error);
    }
  }





  @Reactionary({
    inputSchema: CheckoutMutationFinalizeCheckoutSchema,
    outputSchema: CheckoutSchema,
  })
  public override async finalizeCheckout(
    payload: CheckoutMutationFinalizeCheckout
  ): Promise<Result<CheckoutFactoryCheckoutOutput<TFactory>>> {
    const checkout = await this.getById({ identifier: payload.checkout });
    if (!checkout.success || !checkout.value.readyForFinalization) {
      throw new CheckoutNotReadyForFinalizationError(payload.checkout);
    }

    const client = await this.medusaApi.getClient();
    const medusaId = payload.checkout as CheckoutIdentifier;

    // Complete the cart to create an order
    const response = await client.store.cart.complete(medusaId.key);

    if (response.type === 'order') {
      // lets persist this on the carts metadata for future reference
      const updatedCart = await client.store.cart.update(medusaId.key, {
        metadata: {
          order_id: response.order.id,
          order_display_id: response.order?.display_id ? response.order.display_id + '' : '',
        },
      });
      const refreshedCheckout = await this.getById({
        identifier: payload.checkout,
      });

      const sessionData = this.medusaApi.getSessionData();
      const cartCollectionKey = '_me';
      if (sessionData.allOwnedCarts?.[cartCollectionKey]) {
        const updatedCollection = sessionData.allOwnedCarts[cartCollectionKey].filter(x => x.key !== updatedCart.cart.id);

        this.medusaApi.setSessionData({
          allOwnedCarts: {
            ...sessionData.allOwnedCarts,
            [cartCollectionKey]: updatedCollection,
          },
          activeCartId: updatedCollection.length > 0 ? updatedCollection[0] : undefined,
        });
      }

      if (!refreshedCheckout.success) {
        throw new Error(`Unable to reload checkout ${payload.checkout.key} after completion`);
      }

      return success(refreshedCheckout.value);
    }

    throw new Error('Something failed during order creation');
  }

  /**
   * Extension point to map an Address to a Store Address
   * @param address
   * @returns
   */
  protected mapAddressToStoreAddress(address: Partial<Address>) {
    return {
      first_name: address.firstName,
      last_name: address.lastName,
      address_1: address.streetAddress,
      address_2: address.streetNumber || '',
      city: address.city,
      postal_code: address.postalCode,
      country_code: address.countryCode?.toLowerCase(),
    };
  }


}
