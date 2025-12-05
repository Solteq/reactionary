import type { StoreCart, StoreCartAddress, StoreCartLineItem } from '@medusajs/types';
import type {
  Address,
  AddressIdentifier,
  Cache,
  Checkout,
  CheckoutIdentifier,
  CheckoutItem,
  CheckoutMutationAddPaymentInstruction,
  CheckoutMutationFinalizeCheckout,
  CheckoutMutationInitiateCheckout,
  CheckoutMutationRemovePaymentInstruction,
  CheckoutMutationSetShippingAddress,
  CheckoutMutationSetShippingInstruction,
  CheckoutQueryById,
  CheckoutQueryForAvailablePaymentMethods,
  CheckoutQueryForAvailableShippingMethods,
  CostBreakDown,
  Currency,
  ItemCostBreakdown,
  MonetaryAmount,
  PaymentInstruction,
  PaymentMethod,
  PaymentMethodIdentifier,
  RequestContext,
  ShippingMethod,
  Result,
  NotFoundError
} from '@reactionary/core';
import {
  AddressIdentifierSchema,
  CheckoutMutationAddPaymentInstructionSchema,
  CheckoutMutationFinalizeCheckoutSchema,
  CheckoutMutationInitiateCheckoutSchema,
  CheckoutMutationRemovePaymentInstructionSchema,
  CheckoutMutationSetShippingAddressSchema,
  CheckoutMutationSetShippingInstructionSchema,
  CheckoutProvider,
  CheckoutQueryByIdSchema,
  CheckoutQueryForAvailablePaymentMethodsSchema,
  CheckoutQueryForAvailableShippingMethodsSchema,
  CheckoutSchema,
  MonetaryAmountSchema,
  PaymentMethodSchema,
  Reactionary,
  ShippingMethodIdentifierSchema,
  ShippingMethodSchema,
  success,
  error
} from '@reactionary/core';
import createDebug from 'debug';
import z from 'zod';
import type { MedusaClient } from '../core/client.js';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import { handleProviderError,  parseMedusaCostBreakdown, parseMedusaItemPrice } from '../utils/medusa-helpers.js';
import {
  type MedusaCartIdentifier,
  type MedusaOrderIdentifier
} from '../schema/medusa.schema.js';
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

export class MedusaCheckoutProvider extends CheckoutProvider {
  protected config: MedusaConfiguration;

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
    public client: MedusaClient
  ) {
    super(cache, context);
    this.config = config;
  }

  @Reactionary({
    inputSchema: CheckoutMutationInitiateCheckoutSchema,
    outputSchema: CheckoutSchema,
  })
  public override async initiateCheckoutForCart(
    payload: CheckoutMutationInitiateCheckout
  ): Promise<Result<Checkout>> {
    const client = await this.client.getClient();
    // we should eventually copy the cart.... but for now we just continue with the existing one.
    if (debug.enabled) {
      debug(
        `Initiating checkout for cart with key: ${payload.cart.identifier.key}`
      );
    }
    // zero out existing checkout data?
    const response = await client.store.cart.update(
      payload.cart.identifier.key,
      {
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
      },
      {
        fields: this.includedFields,
      }
    );

    return success(this.parseSingle(response.cart));
  }

  @Reactionary({
    inputSchema: CheckoutQueryByIdSchema,
    outputSchema: CheckoutSchema.nullable(),
  })
  public override async getById(
    payload: CheckoutQueryById
  ): Promise<Result<Checkout, NotFoundError>> {
    const client = await this.client.getClient();
    const response = await client.store.cart.retrieve(payload.identifier.key, {
      fields: this.includedFields,
    });
    return success(this.parseSingle(response.cart));
  }

  @Reactionary({
    inputSchema: CheckoutMutationSetShippingAddressSchema,
    outputSchema: CheckoutSchema,
  })
  public override async setShippingAddress(
    payload: CheckoutMutationSetShippingAddress
  ): Promise<Result<Checkout>> {
    const client = await this.client.getClient();

    const response = await client.store.cart.update(
      payload.checkout.key,
      {
        shipping_address: this.mapAddressToStoreAddress(
          payload.shippingAddress
        ),
      },
      {
        fields: this.includedFields,
      }
    );
    return success(this.parseSingle(response.cart));
  }

  @Reactionary({
    inputSchema: CheckoutQueryForAvailableShippingMethodsSchema,
    outputSchema: z.array(ShippingMethodSchema),
  })
  public override async getAvailableShippingMethods(
    payload: CheckoutQueryForAvailableShippingMethods
  ): Promise<Result<ShippingMethod[]>> {
    const client = await this.client.getClient();

    if (debug.enabled) {
      debug(
        `Fetching available shipping methods for checkout with key: ${payload.checkout.key}`
      );
    }

    const shippingMethodResponse =
      await client.store.fulfillment.listCartOptions({
        cart_id: payload.checkout.key,
      });

    const shippingMethods: ShippingMethod[] = [];

    for (const sm of shippingMethodResponse.shipping_options) {
      shippingMethods.push(
        ShippingMethodSchema.parse({
          identifier: ShippingMethodIdentifierSchema.parse({ key: sm.id }),
          name: sm.name,
          description: sm.type.description || '',
          price: MonetaryAmountSchema.parse({
            value: sm.calculated_price.calculated_amount || 0,
            currency:
              sm.calculated_price.currency_code?.toUpperCase() as Currency,
          } satisfies MonetaryAmount),
          deliveryTime: '',
        } satisfies ShippingMethod)
      );
    }

    if (debug.enabled) {
      debug(
        `Found ${shippingMethods.length} shipping methods for checkout with key: ${payload.checkout.key}`,
        shippingMethods
      );
    }
    return success(shippingMethods);
  }

  @Reactionary({
    inputSchema: CheckoutQueryForAvailablePaymentMethodsSchema,
    outputSchema: z.array(PaymentMethodSchema),
  })
  public override async getAvailablePaymentMethods(
    payload: CheckoutQueryForAvailablePaymentMethods
  ): Promise<Result<PaymentMethod[]>> {
    const client = await this.client.getClient();

    if (debug.enabled) {
      debug(
        `Fetching available payment methods for checkout with key: ${payload.checkout.key}`
      );
    }
    const checkout = await client.store.cart.retrieve(payload.checkout.key);
    const paymentMethodResponse =
      await client.store.payment.listPaymentProviders({
        region_id:
          checkout.cart.region_id || (await this.client.getActiveRegion()).id,
      });

    const paymentMethods: PaymentMethod[] = [];

    for (const pm of paymentMethodResponse.payment_providers) {
      paymentMethods.push(
        {
          identifier: {
            method: pm.id,
            name: pm.id,
            paymentProcessor: pm.id,
          },
          logo: undefined,
          description: pm.id,
          isPunchOut: true,
          meta: {
            cache: {
              hit: false,
              key: '',
            },
            placeholder: false,
          }
        }

      );
    }

    if (debug.enabled) {
      debug(
        `Found ${paymentMethods.length} payment methods for checkout with key: ${payload.checkout.key}`,
        paymentMethods
      );
    }

    return success(paymentMethods);
  }

  @Reactionary({
    inputSchema: CheckoutMutationAddPaymentInstructionSchema,
    outputSchema: CheckoutSchema,
  })
  public override async addPaymentInstruction(
    payload: CheckoutMutationAddPaymentInstruction
  ): Promise<Result<Checkout>> {
    const client = await this.client.getClient();

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
        await client.store.payment.initiatePaymentSession(cartResponse.cart, {
          provider_id: payload.paymentInstruction.paymentMethod.method,
          data: payload.paymentInstruction.protocolData.reduce((acc, curr) => {
            acc[curr.key] = curr.value;
            return acc;
          }, {} as Record<string, string>),
        });

      const updatedCartResponse = await client.store.cart.retrieve(
        payload.checkout.key,
        {
          fields: this.includedFields,
        }
      );

      return success(this.parseSingle(updatedCartResponse.cart));
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
  ): Promise<Result<Checkout>> {
    throw new Error('Method not implemented.');
  }

  @Reactionary({
    inputSchema: CheckoutMutationSetShippingInstructionSchema,
    outputSchema: CheckoutSchema,
  })
  public override async setShippingInstruction(
    payload: CheckoutMutationSetShippingInstruction
  ): Promise<Result<Checkout>> {
    const client = await this.client.getClient();
    const medusaId = payload.checkout as MedusaCartIdentifier;
    try {
      // Set shipping method
      if (payload.shippingInstruction.shippingMethod) {
        await client.store.cart.addShippingMethod(medusaId.key, {
          option_id: payload.shippingInstruction.shippingMethod.key,
          data: {
            consent_for_unattended_delivery:
              payload.shippingInstruction.consentForUnattendedDelivery + '',
            instructions: payload.shippingInstruction.instructions || '',
          },
        });
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
        return success(this.parseSingle(response.cart));
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
  ): Promise<Result<Checkout>> {
    const checkout = await this.getById({ identifier: payload.checkout });
    if (!checkout.success || !checkout.value.readyForFinalization) {
      throw new CheckoutNotReadyForFinalizationError(payload.checkout);
    }

    const client = await this.client.getClient();
    const medusaId = payload.checkout as CheckoutIdentifier;

    // Complete the cart to create an order
    const response = await client.store.cart.complete(medusaId.key);

    if (response.type === 'order') {
      // lets persist this on the carts metadata for future reference
      await client.store.cart.update(medusaId.key, {
        metadata: {
          order_id: response.order.id,
          order_display_id: response.order?.display_id ? +'' : '',
        },
      });
      return this.getById({
        identifier: payload.checkout,
      }) as Promise<Result<Checkout>>;
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

  /**
   * Extension point to control the parsing of an address from a store cart address
   * @param storeAddress
   * @returns
   */
  protected composeAddressFromStoreAddress(storeAddress: StoreCartAddress): Address {
    return {
      identifier: AddressIdentifierSchema.parse({
        nickName: storeAddress.id,
      } satisfies AddressIdentifier),
      firstName: storeAddress.first_name || '',
      lastName: storeAddress.last_name || '',
      streetAddress: storeAddress.address_1 || '',
      streetNumber: storeAddress.address_2 || '',
      city: storeAddress.city || '',
      postalCode: storeAddress.postal_code || '',
      countryCode: storeAddress.country_code || '',
      meta: {
        cache: {
          hit: false,
          key: '',
        },
        placeholder: false,
      },
      region: '',
    };
  }

  /**
   * Extension point to control the parsing of a single cart item price
   * @param remoteItem
   * @param currency
   * @returns
   */
  protected parseItemPrice(
    remoteItem: StoreCartLineItem,
    currency: Currency
  ): ItemCostBreakdown {
    return parseMedusaItemPrice(remoteItem, currency);
  }

  /**
   * Extension point to control the parsing of the cost breakdown of a cart
   * @param remote
   * @returns
   */
  protected parseCostBreakdown(remote: StoreCart): CostBreakDown {
    return parseMedusaCostBreakdown(remote);
  }


  /**
   * Extension point to control the parsing of a single checkout item
   * @param remoteItem
   * @param currency
   * @returns
   */
  protected parseCheckoutItem(
    remoteItem: StoreCartLineItem,
    currency: Currency
  ): CheckoutItem {
    const unitPrice = remoteItem.unit_price || 0;
    const totalPrice = unitPrice * remoteItem.quantity || 0;
    const discountTotal = remoteItem.discount_total || 0;

    const item: CheckoutItem = {
      identifier: {
        key: remoteItem.id,
      },
      variant: {
        sku: remoteItem.variant_sku || '',
      },
      quantity: remoteItem.quantity || 1,

      price:  this.parseItemPrice(remoteItem,currency),
    };
    return item;
  }

  /**
   * Extension point to control the parsing of the Checkout object
   * @param remote
   * @returns
   */
  protected parseSingle(remote: StoreCart): Checkout {
    const identifier = {
      key: remote.id,
      //        region_id: remote.region_id,
    };

    const name = '' + (remote.metadata?.['name'] || '');
    const description = '' + (remote.metadata?.['description'] || '');

    const price = this.parseCostBreakdown(remote);

    // Parse checkout items
    const items = new Array<CheckoutItem>();
    for (const remoteItem of remote.items || []) {
      items.push(this.parseCheckoutItem(remoteItem, price.grandTotal.currency));
    }

    const meta = {
      cache: {
        hit: false,
        key: this.generateCacheKeySingle(identifier),
      },
      placeholder: false,
    };

    const billingAddress = remote.billing_address
      ? this.composeAddressFromStoreAddress(remote.billing_address)
      : undefined;
    const shippingAddress = remote.shipping_address
      ? this.composeAddressFromStoreAddress(remote.shipping_address)
      : undefined;

    const backupUnattendedDelivery =
      remote.metadata?.['consent_for_unattended_delivery'] !== undefined
        ? remote.metadata?.['consent_for_unattended_delivery'] === 'true'
        : undefined;
    const backupInstructions =
      remote.metadata?.['instructions'] !== undefined
        ? remote.metadata?.['instructions'] + ''
        : undefined;
    const backupPickupPoint =
      remote.metadata?.['pickup_point'] !== undefined
        ? remote.metadata?.['pickup_point'] + ''
        : undefined;

    let shippingInstruction;
    remote.shipping_methods?.forEach((sm) => {
      let pickupPoint = '';
      let instructions = '';
      let consentForUnattendedDelivery = false;
      if (sm.data) {
        pickupPoint = sm.data['pickup_point'] + '' || '';
        instructions = sm.data['instructions'] + '' || '';
        consentForUnattendedDelivery =
          sm.data['consent_for_unattended_delivery'] === 'true';
      }

      if (!pickupPoint) {
        pickupPoint = backupPickupPoint || '';
      }
      if (!instructions) {
        instructions = backupInstructions || '';
      }
      if (!consentForUnattendedDelivery) {
        consentForUnattendedDelivery = backupUnattendedDelivery || false;
      }

      // currently Medusa only supports one shipping method per cart
      shippingInstruction = {
        shippingMethod: { key: sm.shipping_option_id },
        consentForUnattendedDelivery,
        instructions,
        pickupPoint,
        meta,
      };
    });

    const paymentInstructions = new Array<PaymentInstruction>();
    for (const remotePayment of remote.payment_collection?.payment_sessions ||
      []) {
      if (
        remotePayment.status === 'canceled' ||
        remotePayment.status === 'error'
      ) {
        console.warn(
          `Skipping payment session ${remotePayment.id} with status ${remotePayment.status}`
        );
        continue;
      }
      const paymentMethodIdentifier: PaymentMethodIdentifier = {
        method: remotePayment.provider_id,
        name: remotePayment.provider_id,
        paymentProcessor: remotePayment.provider_id,
      };

      paymentInstructions.push({
          meta,
          identifier: {
            key: remotePayment.id,
          },
          amount: {
            value: remotePayment.amount,
            currency: remotePayment.currency_code?.toUpperCase() as Currency,
          },
          paymentMethod: paymentMethodIdentifier,
          protocolData: remotePayment.data
            ? Object.entries(remotePayment.data).map(([key, value]) => ({
                key,
                value: String(value),
              }))
            : [],
          status: 'pending',
        }
      );
    }

    const originalCartReference: MedusaCartIdentifier = {
      key: remote.id,
      region: remote.region_id,
    };

    let resultingOrder: MedusaOrderIdentifier | undefined = undefined;
    if (remote.metadata?.['order_id']) {
      resultingOrder = {
        key: remote.metadata?.['order_id'] + '' || '',
        display_id: Number(remote.metadata?.['order_display_id'] + '' || '0'),
      };
    }

    const result: Checkout = {
      identifier,
      name,
      description,
      price,
      items,
      meta,
      originalCartReference,
      paymentInstructions,
      readyForFinalization: false,
      billingAddress,
      resultingOrder,
      shippingAddress,
      shippingInstruction
    };

    return result;
  }
}
