import type { StoreAddCartShippingMethods, StoreCalculatedPrice, StoreInitializePaymentSession, StoreOrder, StoreUpdateCart } from '@medusajs/types';
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
  ShippingMethod,
  ShippingProtocolData,
  StoreIdentifier
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
  error,
  Reactionary,
  ShippingMethodIdentifierSchema,
  ShippingMethodSchema,
  success
} from '@reactionary/core';
import createDebug from 'debug';
import * as z from 'zod';
import { MedusaAdminAPI, type MedusaAPI } from '../core/client.js';
import type { MedusaCheckoutFactory } from '../factories/checkout/checkout.factory.js';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import {
  type MedusaCartIdentifier,
  type MedusaOrderIdentifier
} from '../schema/medusa.schema.js';
import { handleProviderError, isNotFoundFetchError } from '../utils/medusa-helpers.js';
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
  protected includedFields: string = ['+items.*', '+order.id','+order.display_id', '+order.custom_display_id', '+shipping_methods.data'].join(',');

  /**
   * This controls which fields are requested for the cart's shipping options.
   * You can override this in a subclass to add more fields as needed.
   *
   * The service zone's fulfillment set tells us whether an option is in-store
   * pickup (BOPIS) or a delivery, and the option data is the fulfillment
   * provider's payload (e.g. nShift option/carrier ids) that is mapped to the
   * shipping method's protocolData.
   */
  protected shippingOptionFields: string = ['*service_zone.fulfillment_set', '+data'].join(',');



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
    try {
      const response = await client.store.cart.retrieve(payload.identifier.key, {
        fields: this.includedFields,
      });
      return success(
        this.hydrateResultingOrder(this.factory.parseCheckout(this.context, response.cart)),
      );
    } catch (err) {
      if (isNotFoundFetchError(err)) {
        return error<NotFoundError>({
          type: 'NotFound',
          identifier: payload.identifier,
        });
      }
      handleProviderError('get checkout by id', err);
    }
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
      fields: this.shippingOptionFields,
    }
  }

  /**
   * Whether a Medusa shipping option's calculated price is usable, i.e. has an
   * actual amount (which may be `0` for valid free shipping) rather than no
   * price data at all. `calculated_amount`/`original_amount` are `number | null`;
   * checking them with a plain falsy check would incorrectly treat a `0` amount
   * (free shipping) the same as a missing price and drop the option.
   *
   * Override this if a project needs different rules for which shipping
   * options are considered usable.
   */
  protected hasUsableShippingPrice(calculatedPrice: StoreCalculatedPrice | null | undefined): boolean {
    if (!calculatedPrice) {
      return false;
    }
    return calculatedPrice.calculated_amount != null || calculatedPrice.original_amount != null;
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
    if (debug.enabled) {
      debug(
        `Found ${shippingMethodResponse.shipping_options.length} shipping methods for checkout with key: ${payload.checkout.key}`,
        shippingMethodResponse.shipping_options
      );
    }

    // For shipping methods that are calculated, we need to calculate the price for the specific cart.
    const calculatedPricesPromises = shippingMethodResponse.shipping_options.filter(x => x.price_type === 'calculated' && !x.calculated_price).map(async (sm) => {
      const updatedSM = await client.store.fulfillment.calculate(sm.id, {
        cart_id: payload.checkout.key,
      });
      sm.calculated_price = updatedSM.shipping_option.calculated_price;
    });
    if (calculatedPricesPromises.length > 0) {
      if (debug.enabled) {
        debug('Calculating prices for {0} shipping methods for checkout with key: {1}', [calculatedPricesPromises.length, payload.checkout.key]);
      }
      await Promise.all(calculatedPricesPromises);

      if (debug.enabled) {
        debug('Finished calculating prices for {0} shipping methods for checkout with key: {1}', [calculatedPricesPromises.length, payload.checkout.key]);
        debug(`Updated shipping methods for checkout with key: ${payload.checkout.key}`, shippingMethodResponse.shipping_options);
      }
    }

    for (const sm of shippingMethodResponse.shipping_options) {
      if (!this.hasUsableShippingPrice(sm.calculated_price)) {
        console.warn(`Skipping shipping method ${sm.name}/${sm.provider.id} because it has no calculated price for checkout ${payload.checkout.key}`);
        continue;
      }
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
    const data: Record<string, unknown> = {
      consent_for_unattended_delivery:
        payload.shippingInstruction.consentForUnattendedDelivery + '',
      instructions: payload.shippingInstruction.instructions || '',
    };

    // Client-set protocol data travels on the shipping method's own data,
    // where the backend merges it into the persisted provider payload (e.g.
    // the chosen nShift service point agent). The selected third-party
    // service point rides along the same channel.
    for (const entry of payload.shippingInstruction.protocolData ?? []) {
      data[entry.key] = entry.value;
    }
    if (payload.shippingInstruction.pickupPoint) {
      data['pickup_point'] = payload.shippingInstruction.pickupPoint;
    }

    return {
      option_id: payload.shippingInstruction.shippingMethod.key,
      data,
    };
  }

  /**
   * Serializes the client-set shipping protocol data as a JSON object string
   * for persistence in the cart metadata, or undefined when none is set.
   */
  protected serializeShippingProtocolData(
    protocolData: ShippingProtocolData[] | undefined,
  ): string | undefined {
    if (!protocolData || protocolData.length === 0) {
      return undefined;
    }
    return JSON.stringify(
      Object.fromEntries(protocolData.map((entry) => [entry.key, entry.value])),
    );
  }

  /**
   * Resolves the shipping address to use for in-store pickup (BOPIS): the
   * address of the selected store, so the order ships to the store. Returns
   * undefined when the store or its address is unknown, leaving the cart's
   * shipping address untouched.
   */
  protected async resolveStorePickupAddress(
    store: StoreIdentifier,
  ): Promise<Partial<Address> | undefined> {
    try {
      const adminClient = await (new MedusaAdminAPI(this.config, this.context).getClient());
      const response = await adminClient.admin.stockLocation.retrieve(store.key, {
        fields: '*address',
      });

      const address = response.stock_location?.address;
      if (!address) {
        return undefined;
      }

      return {
        firstName: '',
        lastName: response.stock_location.name,
        streetAddress: address.address_1 || '',
        streetNumber: address.address_2 || '',
        city: address.city || '',
        postalCode: address.postal_code || '',
        countryCode: address.country_code || '',
      };
    } catch (err) {
      if (debug.enabled) {
        debug(`Unable to resolve address for pickup store ${store.key}`, err);
      }
      return undefined;
    }
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
      const cartUpdate: StoreUpdateCart = {
        metadata: {
          consent_for_unattended_delivery:
            payload.shippingInstruction.consentForUnattendedDelivery + '',
          instructions: payload.shippingInstruction.instructions || '',
          pickup_point: payload.shippingInstruction.pickupPoint || '',
          pickup_store: payload.shippingInstruction.store?.key || '',
          shipping_protocol_data:
            this.serializeShippingProtocolData(payload.shippingInstruction.protocolData) || '',
        },
      };

      // For in-store pickup (BOPIS), ship the order to the selected store's
      // address. Carts without a store keep their current behavior.
      if (payload.shippingInstruction.store?.key) {
        const storeAddress = await this.resolveStorePickupAddress(payload.shippingInstruction.store);
        if (storeAddress) {
          cartUpdate.shipping_address = this.mapAddressToStoreAddress(storeAddress);
        }
      }

      await client.store.cart.update(medusaId.key, cartUpdate);

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
    let checkout = await this.getById({ identifier: payload.checkout });
    if (!checkout.success) {
      // propagate the typed error (e.g. NotFound) instead of masking it as
      // a readiness problem
      return checkout;
    }
    if (!checkout.value.readyForFinalization) {
      throw new CheckoutNotReadyForFinalizationError(payload.checkout);
    }

    // medusa already most likely created the order. If it did, we can just return clean up local state and return the order.
    if (!checkout.value.resultingOrder) {
      const client = await this.medusaApi.getClient();
      const medusaId = payload.checkout as CheckoutIdentifier;

      // Stamp the cart's own id into its metadata so Medusa's completion
      // copies it onto the created order. Write-only for now: nothing reads
      // it back yet, it is recorded for future order-to-cart correlation.
      await client.store.cart.update(medusaId.key, {
        metadata: {
          cart_id: medusaId.key,
        },
      });

      // Complete the cart to create an order
      const response = await client.store.cart.complete(medusaId.key);

      if (response.type === 'order') {
        // The completion response already carries the full order. Newer
        // Medusa versions no longer expose the cart->order relation on the
        // store cart endpoint (the +order.* fields come back empty), so this
        // is the authoritative source for the resulting order; remember it in
        // the session so later checkout reads can hydrate it too.
        const resultingOrder = this.parseCompletedOrderIdentifier(response.order);
        this.rememberFinalizedOrder(medusaId.key, resultingOrder);

        checkout = await this.getById({
          identifier: payload.checkout,
        });
        if (!checkout.success) {
          throw new Error(`Unable to reload checkout ${payload.checkout.key} after completion`);
        }
        if (!checkout.value.resultingOrder) {
          checkout = success({ ...checkout.value, resultingOrder });
        }
      } else {
        throw new Error(`Failed to finalize checkout ${payload.checkout.key}. Expected order, got ${response.type}`);
      }
    }

    const originatingCartRef = checkout.value.originalCartReference;

    const sessionData = this.medusaApi.getSessionData();
    const cartCollectionKey = '_me';
    if (sessionData.allOwnedCarts?.[cartCollectionKey]) {
      const updatedCollection = sessionData.allOwnedCarts[cartCollectionKey].filter(x => x.key !== originatingCartRef?.key);

      this.medusaApi.setSessionData({
        allOwnedCarts: {
          ...sessionData.allOwnedCarts,
          [cartCollectionKey]: updatedCollection,
        },
        activeCartId: updatedCollection.length > 0 ? updatedCollection[0] : undefined,
      });
    }
    return success(checkout.value);
  }

  /**
   * Builds the order identifier from a completed-cart response's order,
   * following the same display-id precedence as the checkout factory
   * (custom_display_id over display_id).
   */
  protected parseCompletedOrderIdentifier(
    order: StoreOrder & { custom_display_id?: string | number },
  ): MedusaOrderIdentifier {
    const rawDisplayId = order.custom_display_id ?? order.display_id;
    const displayId = rawDisplayId != null ? Number(`${rawDisplayId}`) : undefined;

    return {
      key: order.id,
      display_id: displayId != null && Number.isFinite(displayId) ? displayId : undefined,
    } satisfies MedusaOrderIdentifier;
  }

  /**
   * Remembers which order a finalized cart produced, so later checkout reads
   * in the same session can report the resulting order even when the Medusa
   * store cart endpoint does not expose the cart->order relation.
   */
  protected rememberFinalizedOrder(
    cartKey: string,
    order: MedusaOrderIdentifier,
  ): void {
    const sessionData = this.medusaApi.getSessionData();
    this.medusaApi.setSessionData({
      finalizedOrders: {
        ...(sessionData.finalizedOrders || {}),
        [cartKey]: order,
      },
    });
  }

  /**
   * Fills in a missing resultingOrder from the session's finalized-orders map.
   * Checkouts that already carry a resulting order (older Medusa versions
   * still hydrate the +order.* fields) are returned unchanged.
   */
  protected hydrateResultingOrder(
    checkout: CheckoutFactoryCheckoutOutput<TFactory>,
  ): CheckoutFactoryCheckoutOutput<TFactory> {
    if (checkout.resultingOrder) {
      return checkout;
    }

    const remembered =
      this.medusaApi.getSessionData().finalizedOrders?.[checkout.identifier.key];
    if (!remembered) {
      return checkout;
    }

    return { ...checkout, resultingOrder: remembered };
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
