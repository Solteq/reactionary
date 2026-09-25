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
  MagentoPaymentMethodPayload,
  MagentoStoredPaymentInstruction,
} from '../schema/magento.types.js';

const debug = createDebug('reactionary:magento:checkout');

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

/**
 * Reads a customer-entered address from a quote's raw `billing_address`.
 * Magento pre-creates a stub on every quote (country set, everything else
 * empty), which is not an address and yields `undefined`.
 */
function parseQuoteAddress(
  raw: Record<string, unknown>,
): MagentoCheckoutAddress | undefined {
  const rawStreet = raw['street'];
  const street = Array.isArray(rawStreet)
    ? rawStreet.filter((line): line is string => nonEmptyString(line) !== undefined)
    : [];
  const firstname = nonEmptyString(raw['firstname']);
  const city = nonEmptyString(raw['city']);
  if (!firstname || !city || street.length === 0) {
    return undefined;
  }
  return {
    firstname,
    lastname: nonEmptyString(raw['lastname']),
    street,
    city,
    company: nonEmptyString(raw['company']),
    region: nonEmptyString(raw['region']),
    region_id: numberValue(raw['region_id']),
    region_code: nonEmptyString(raw['region_code']),
    customer_address_id: numberValue(raw['customer_address_id']),
    postcode: nonEmptyString(raw['postcode']),
    country_id: nonEmptyString(raw['country_id']),
    telephone: nonEmptyString(raw['telephone']),
    email: nonEmptyString(raw['email']),
  };
}

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

  /**
   * The quote's `billing_address` is the only checkout data Magento keeps
   * durably before an order is placed, so it is where email and address
   * survive between requests. Never throws: a missing quote simply yields
   * nothing to fall back to.
   */
  protected async readQuoteBillingAddress(cartKey: string): Promise<{
    email?: string;
    countryId?: string;
    address?: MagentoCheckoutAddress;
  }> {
    try {
      const cart: MagentoCart = await this.magentoApi.getCart(cartKey);
      const raw = cart.billing_address;
      if (!raw) {
        return {};
      }
      return {
        email: nonEmptyString(raw['email']),
        countryId: nonEmptyString(raw['country_id']),
        address: parseQuoteAddress(raw),
      };
    } catch (err) {
      debug('Failed to read billing address from quote: %O', err);
      return {};
    }
  }

  /**
   * Loads the session checkout state and, when this request's session does
   * not know the email or billing address (e.g. every request in a web
   * storefront starts with an empty session), rebuilds them from the quote.
   */
  protected async loadCheckoutState(cartKey: string): Promise<MagentoCheckoutState> {
    const state = await this.magentoApi.getCheckoutState(cartKey);
    if (!state.email || !state.billingAddress) {
      const quote = await this.readQuoteBillingAddress(cartKey);
      state.email = state.email || quote.email;
      state.billingAddress = state.billingAddress ?? quote.address;
    }
    return state;
  }

  protected async persistBillingAddressOnQuote(
    cartKey: string,
    address: MagentoCheckoutAddress,
  ): Promise<void> {
    try {
      await this.magentoApi.setCheckoutBillingAddress(cartKey, address);
    } catch (err) {
      debug('Failed to persist billing address on quote: %O', err);
    }
  }

  /**
   * Stores the email on the quote before any address is known. Magento only
   * accepts a billing address with a country, so this reuses the country the
   * quote already carries (Magento pre-fills the store's default country)
   * rather than inventing one; without it the email stays session-only.
   */
  protected async persistEmailOnQuote(
    cartKey: string,
    state: MagentoCheckoutState,
  ): Promise<void> {
    let address = state.billingAddress;
    if (!address) {
      const { countryId } = await this.readQuoteBillingAddress(cartKey);
      address = countryId ? { country_id: countryId } : undefined;
    }
    if (!address) {
      debug('Quote has no country; email for %s is kept in the session only', cartKey);
      return;
    }
    await this.persistBillingAddressOnQuote(cartKey, { ...address, email: state.email });
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
    const state = await this.loadCheckoutState(cartKey);

    state.email = payload.notificationEmail ?? state.email;
    state.phone = payload.notificationPhone ?? state.phone;

    if (payload.billingAddress) {
      state.billingAddress = this.toMagentoAddress(
        payload.billingAddress,
        state.email,
      );
      await this.persistBillingAddressOnQuote(cartKey, state.billingAddress);
    } else if (payload.notificationEmail) {
      await this.persistEmailOnQuote(cartKey, state);
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
      const state = await this.loadCheckoutState(cartKey);
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
    const state = await this.loadCheckoutState(cartKey);

    state.shippingAddress = this.toMagentoAddress(
      payload.shippingAddress,
      state.email,
    );

    // Magento has no quote field for a shipping address without a shipping
    // method, so the billing address is the only place it survives until the
    // next request. Trade-off: a differing explicit billing address is only
    // kept for this request until setShippingInstruction stores both.
    await this.persistBillingAddressOnQuote(cartKey, state.shippingAddress);

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
    const state = await this.loadCheckoutState(cartKey);
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
    const state = await this.loadCheckoutState(cartKey);

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
    const state = await this.loadCheckoutState(cartKey);

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
    const state = await this.loadCheckoutState(cartKey);
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
    const state = await this.loadCheckoutState(cartKey);

    // A repeated submit must not attempt a second order.
    if (state.orderId) {
      return success(await this.buildOrderedCheckout(cartKey, state));
    }

    const paymentInstruction = state.paymentInstructions?.[0];
    if (!paymentInstruction || !state.shippingInstruction) {
      throw new CheckoutNotReadyForFinalizationError(payload.checkout);
    }

    const orderId = await this.magentoApi.placeOrder(cartKey, {
      email: state.email,
      paymentMethod: this.toMagentoPaymentMethod(paymentInstruction),
      billingAddress: state.billingAddress,
    });

    state.orderId = String(orderId);
    await this.magentoApi.setCheckoutState(cartKey, state);
    await this.magentoApi.clearActiveCartId();

    return success(await this.buildOrderedCheckout(cartKey, state));
  }

  /**
   * Forwards the payment instruction's protocol data (e.g. a PSP transaction
   * id) as Magento's `additional_data`, which payment methods read on placement.
   */
  protected toMagentoPaymentMethod(
    instruction: MagentoStoredPaymentInstruction,
  ): MagentoPaymentMethodPayload {
    if (instruction.protocolData.length === 0) {
      return { method: instruction.method };
    }
    return {
      method: instruction.method,
      additional_data: Object.fromEntries(
        instruction.protocolData.map(({ key, value }) => [key, value]),
      ),
    };
  }

  protected async buildOrderedCheckout(
    cartKey: string,
    state: MagentoCheckoutState,
  ): Promise<CheckoutFactoryCheckoutOutput<TFactory>> {
    // The quote is consumed once the order is placed, so the cart may no longer
    // be retrievable; fall back to a minimal representation carrying the order.
    try {
      return await this.buildCheckout(cartKey, state);
    } catch (err) {
      debug('Cart no longer retrievable after order placement: %O', err);
      const data: MagentoCheckoutData = {
        cart: { id: 0, items: [], customer: {} },
        state,
        requestedKey: cartKey,
      };
      return this.factory.parseCheckout(this.context, data);
    }
  }
}
