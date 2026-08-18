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
  PaymentMethodSchema,
  Reactionary,
  ShippingMethodSchema,
  error,
  success,
  type Address,
  type Cache,
  type CheckoutFactory,
  type CheckoutFactoryCheckoutOutput,
  type CheckoutFactoryPaymentMethodOutput,
  type CheckoutFactoryShippingMethodOutput,
  type CheckoutFactoryWithOutput,
  type CheckoutIdentifier,
  type CheckoutMutationAddPaymentInstruction,
  type CheckoutMutationFinalizeCheckout,
  type CheckoutMutationInitiateCheckout,
  type CheckoutMutationRemovePaymentInstruction,
  type CheckoutMutationSetShippingAddress,
  type CheckoutMutationSetShippingInstruction,
  type CheckoutQueryById,
  type CheckoutQueryForAvailablePaymentMethods,
  type CheckoutQueryForAvailableShippingMethods,
  type NotFoundError,
  type RequestContext,
  type Result,
} from '@reactionary/core';
import createDebug from 'debug';
import * as z from 'zod';
import type { MagentoClient } from '../core/client.js';
import {
  encodeShippingMethodKey,
  type MagentoCheckoutData,
  type MagentoCheckoutFactory,
} from '../factories/checkout/checkout.factory.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import type {
  MagentoCart,
  MagentoCartTotals,
  MagentoCheckoutAddress,
  MagentoCheckoutState,
  MagentoStoredPaymentInstruction,
} from '../schema/magento.types.js';

const debug = createDebug('reactionary:magento:checkout');

export class CheckoutNotReadyForFinalizationError extends Error {
  constructor(public checkoutIdentifier: CheckoutIdentifier) {
    super(
      `Checkout is not ready for finalization. Checkout ID: ${JSON.stringify(checkoutIdentifier)}`,
    );
    this.name = 'CheckoutNotReadyForFinalizationError';
  }
}

export class MagentoCheckoutCapability<
  TFactory extends CheckoutFactory = MagentoCheckoutFactory,
> extends CheckoutCapability<
  CheckoutFactoryCheckoutOutput<TFactory>,
  CheckoutFactoryShippingMethodOutput<TFactory>,
  CheckoutFactoryPaymentMethodOutput<TFactory>
> {
  protected config: MagentoConfiguration;
  protected factory: CheckoutFactoryWithOutput<TFactory>;

  constructor(
    config: MagentoConfiguration,
    cache: Cache,
    context: RequestContext,
    public magentoApi: MagentoClient,
    factory: CheckoutFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
  }

  protected toMagentoAddress(
    address: Omit<Address, 'identifier'>,
    email?: string,
  ): MagentoCheckoutAddress {
    return {
      firstname: address.firstName,
      lastname: address.lastName,
      street: [address.streetAddress, address.streetNumber].filter(
        (part): part is string => Boolean(part),
      ),
      city: address.city,
      region: address.region || undefined,
      postcode: address.postalCode,
      country_id: address.countryCode,
      telephone: '000',
      email,
    };
  }

  protected async loadCartAndTotals(
    cartKey: string,
  ): Promise<{ cart: MagentoCart; totals?: MagentoCartTotals }> {
    const cart = (await this.magentoApi.getCart(cartKey)) as MagentoCart;
    let totals: MagentoCartTotals | undefined;
    try {
      totals = (await this.magentoApi.getCartTotals(cartKey)) as MagentoCartTotals;
    } catch (err) {
      debug('Failed to fetch cart totals: %O', err);
    }
    return { cart, totals };
  }

  protected async buildCheckout(
    cartKey: string,
    state: MagentoCheckoutState,
  ): Promise<CheckoutFactoryCheckoutOutput<TFactory>> {
    const { cart, totals } = await this.loadCartAndTotals(cartKey);
    const data: MagentoCheckoutData = {
      cart,
      totals,
      state,
      requestedKey: cartKey,
    };
    return this.factory.parseCheckout(this.context, data);
  }

  @Reactionary({
    inputSchema: CheckoutMutationInitiateCheckoutSchema,
    outputSchema: CheckoutSchema,
  })
  public override async initiateCheckoutForCart(
    payload: CheckoutMutationInitiateCheckout,
  ): Promise<Result<CheckoutFactoryCheckoutOutput<TFactory>>> {
    const cartKey = payload.cart.identifier.key;
    const state = await this.magentoApi.getCheckoutState(cartKey);

    state.email = payload.notificationEmail ?? state.email;
    state.phone = payload.notificationPhone ?? state.phone;

    if (payload.billingAddress) {
      const billingAddress = this.toMagentoAddress(
        payload.billingAddress,
        state.email,
      );
      state.billingAddress = billingAddress;
      try {
        await this.magentoApi.setCheckoutBillingAddress(cartKey, billingAddress);
      } catch (err) {
        debug('Failed to persist billing address on quote: %O', err);
      }
    }

    await this.magentoApi.setCheckoutState(cartKey, state);
    return success(await this.buildCheckout(cartKey, state));
  }

  @Reactionary({
    inputSchema: CheckoutQueryByIdSchema,
    outputSchema: CheckoutSchema.nullable(),
  })
  public override async getById(
    payload: CheckoutQueryById,
  ): Promise<Result<CheckoutFactoryCheckoutOutput<TFactory>, NotFoundError>> {
    const cartKey = payload.identifier.key;
    try {
      const state = await this.magentoApi.getCheckoutState(cartKey);
      return success(await this.buildCheckout(cartKey, state));
    } catch (err) {
      debug('Failed to load checkout: %O', err);
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.identifier,
      });
    }
  }

  @Reactionary({
    inputSchema: CheckoutMutationSetShippingAddressSchema,
    outputSchema: CheckoutSchema,
  })
  public override async setShippingAddress(
    payload: CheckoutMutationSetShippingAddress,
  ): Promise<Result<CheckoutFactoryCheckoutOutput<TFactory>>> {
    const cartKey = payload.checkout.key;
    const state = await this.magentoApi.getCheckoutState(cartKey);

    state.shippingAddress = this.toMagentoAddress(
      payload.shippingAddress,
      state.email,
    );

    await this.magentoApi.setCheckoutState(cartKey, state);
    return success(await this.buildCheckout(cartKey, state));
  }

  @Reactionary({
    inputSchema: CheckoutQueryForAvailableShippingMethodsSchema,
    outputSchema: z.array(ShippingMethodSchema),
  })
  public override async getAvailableShippingMethods(
    payload: CheckoutQueryForAvailableShippingMethods,
  ): Promise<Result<CheckoutFactoryShippingMethodOutput<TFactory>[]>> {
    const cartKey = payload.checkout.key;
    const state = await this.magentoApi.getCheckoutState(cartKey);
    const address = state.shippingAddress || state.billingAddress;

    if (!address) {
      return success([]);
    }

    const methods = await this.magentoApi.estimateShippingMethods(cartKey, address);
    const shippingMethods = methods
      .filter((method) => method.available)
      .map((method) => this.factory.parseShippingMethod(this.context, method));

    return success(shippingMethods);
  }

  @Reactionary({
    inputSchema: CheckoutQueryForAvailablePaymentMethodsSchema,
    outputSchema: z.array(PaymentMethodSchema),
  })
  public override async getAvailablePaymentMethods(
    payload: CheckoutQueryForAvailablePaymentMethods,
  ): Promise<Result<CheckoutFactoryPaymentMethodOutput<TFactory>[]>> {
    const cartKey = payload.checkout.key;
    const methods = await this.magentoApi.getPaymentMethods(cartKey);
    const paymentMethods = methods.map((method) =>
      this.factory.parsePaymentMethod(this.context, method),
    );
    return success(paymentMethods);
  }

  @Reactionary({
    inputSchema: CheckoutMutationAddPaymentInstructionSchema,
    outputSchema: CheckoutSchema,
  })
  public override async addPaymentInstruction(
    payload: CheckoutMutationAddPaymentInstruction,
  ): Promise<Result<CheckoutFactoryCheckoutOutput<TFactory>>> {
    const cartKey = payload.checkout.key;
    const state = await this.magentoApi.getCheckoutState(cartKey);

    const instruction: MagentoStoredPaymentInstruction = {
      key: `pi_${Date.now()}`,
      method: payload.paymentInstruction.paymentMethod.method,
      name: payload.paymentInstruction.paymentMethod.name,
      paymentProcessor: payload.paymentInstruction.paymentMethod.paymentProcessor,
      amountValue: payload.paymentInstruction.amount.value,
      amountCurrency: payload.paymentInstruction.amount.currency,
      protocolData: payload.paymentInstruction.protocolData,
      status: 'pending',
    };

    state.paymentInstructions = [
      ...(state.paymentInstructions ?? []),
      instruction,
    ];

    await this.magentoApi.setCheckoutState(cartKey, state);
    return success(await this.buildCheckout(cartKey, state));
  }

  @Reactionary({
    inputSchema: CheckoutMutationRemovePaymentInstructionSchema,
    outputSchema: CheckoutSchema,
  })
  public override async removePaymentInstruction(
    payload: CheckoutMutationRemovePaymentInstruction,
  ): Promise<Result<CheckoutFactoryCheckoutOutput<TFactory>>> {
    const cartKey = payload.checkout.key;
    const state = await this.magentoApi.getCheckoutState(cartKey);

    state.paymentInstructions = (state.paymentInstructions ?? []).filter(
      (pi) => pi.key !== payload.paymentInstruction.key,
    );

    await this.magentoApi.setCheckoutState(cartKey, state);
    return success(await this.buildCheckout(cartKey, state));
  }

  @Reactionary({
    inputSchema: CheckoutMutationSetShippingInstructionSchema,
    outputSchema: CheckoutSchema,
  })
  public override async setShippingInstruction(
    payload: CheckoutMutationSetShippingInstruction,
  ): Promise<Result<CheckoutFactoryCheckoutOutput<TFactory>>> {
    const cartKey = payload.checkout.key;
    const state = await this.magentoApi.getCheckoutState(cartKey);
    const address = state.shippingAddress || state.billingAddress;

    if (!address) {
      return error({
        type: 'InvalidInput',
        error: 'A shipping or billing address is required before selecting a shipping method',
      });
    }

    const requestedKey = payload.shippingInstruction.shippingMethod.key;
    const methods = await this.magentoApi.estimateShippingMethods(cartKey, address);
    const method = methods.find(
      (m) => encodeShippingMethodKey(m.carrier_code, m.method_code) === requestedKey,
    );

    if (!method) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.shippingInstruction.shippingMethod,
      });
    }

    await this.magentoApi.setShippingInformation(cartKey, {
      addressInformation: {
        shipping_address: address,
        billing_address: state.billingAddress ?? address,
        shipping_method_code: method.method_code,
        shipping_carrier_code: method.carrier_code,
      },
    });

    state.shippingInstruction = {
      shippingMethodKey: requestedKey,
      carrierCode: method.carrier_code,
      methodCode: method.method_code,
      instructions: payload.shippingInstruction.instructions || '',
      pickupPoint: payload.shippingInstruction.pickupPoint || '',
      consentForUnattendedDelivery:
        payload.shippingInstruction.consentForUnattendedDelivery,
    };

    await this.magentoApi.setCheckoutState(cartKey, state);
    return success(await this.buildCheckout(cartKey, state));
  }

  @Reactionary({
    inputSchema: CheckoutMutationFinalizeCheckoutSchema,
    outputSchema: CheckoutSchema,
  })
  public override async finalizeCheckout(
    payload: CheckoutMutationFinalizeCheckout,
  ): Promise<Result<CheckoutFactoryCheckoutOutput<TFactory>>> {
    const cartKey = payload.checkout.key;
    const state = await this.magentoApi.getCheckoutState(cartKey);

    const paymentInstruction = state.paymentInstructions?.[0];
    if (!paymentInstruction || !state.shippingInstruction) {
      throw new CheckoutNotReadyForFinalizationError(payload.checkout);
    }

    const orderId = await this.magentoApi.placeOrder(cartKey, {
      email: state.email,
      paymentMethod: {
        method: paymentInstruction.method,
      },
      billingAddress: state.billingAddress,
    });

    state.orderId = String(orderId);
    await this.magentoApi.setCheckoutState(cartKey, state);
    await this.magentoApi.clearActiveCartId();

    // The quote is consumed once the order is placed, so the cart may no longer
    // be retrievable; fall back to a minimal representation carrying the order.
    try {
      return success(await this.buildCheckout(cartKey, state));
    } catch (err) {
      debug('Cart no longer retrievable after order placement: %O', err);
      const data: MagentoCheckoutData = {
        cart: { id: 0, items: [], customer: {} },
        state,
        requestedKey: cartKey,
      };
      return success(this.factory.parseCheckout(this.context, data));
    }
  }
}
