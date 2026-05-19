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
  ShippingMethodSchema,
  Reactionary,
  error,
  success,
  type Cache,
  type CheckoutFactory,
  type CheckoutFactoryCheckoutOutput,
  type CheckoutFactoryPaymentMethodOutput,
  type CheckoutFactoryShippingMethodOutput,
  type CheckoutFactoryWithOutput,
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
import type { HclConfiguration } from '../schema/configuration.schema.js';
import { HclCartNotFoundError, type HclClient } from '../core/client.js';
import type { HclCheckoutFactory } from '../factories/checkout/checkout.factory.js';
import type {
  HclWcsAddress,
  HclWcsCartResponse,
  HclWcsOrderIdContainer,
  HclWcsPaymentMethodsResponse,
  HclWcsShipModesResponse,
} from '../schema/hcl.schema.js';
import createDebug from 'debug';

const debug = createDebug('reactionary:hcl:checkout');

export class HclCheckoutCapability<
  TFactory extends CheckoutFactory = HclCheckoutFactory,
> extends CheckoutCapability<
  CheckoutFactoryCheckoutOutput<TFactory>,
  CheckoutFactoryShippingMethodOutput<TFactory>,
  CheckoutFactoryPaymentMethodOutput<TFactory>
> {
  protected config: HclConfiguration;
  protected client: HclClient;
  protected factory: CheckoutFactoryWithOutput<TFactory>;

  constructor(
    cache: Cache,
    context: RequestContext,
    config: HclConfiguration,
    client: HclClient,
    factory: CheckoutFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.client = client;
    this.factory = factory;
  }

  /** Fetch the raw WCS cart response. Throws HclCartNotFoundError on 404. */
  protected async fetchWcsCart(): Promise<HclWcsCartResponse> {
    const data = await this.client.callGet<HclWcsCartResponse>(
      `${this.client.transactionBaseUrl}/cart/@self`,
      undefined,
      { allowUndefined: true },
    );
    if (!data) throw new HclCartNotFoundError();
    return data;
  }

  /** Fetch and parse the active cart as a Checkout. */
  protected async fetchCheckout(
    extra?: Partial<HclWcsCartResponse & { resultingOrderKey?: string }>,
  ): Promise<CheckoutFactoryCheckoutOutput<TFactory>> {
    const data = await this.fetchWcsCart();
    return this.factory.parseCheckout(this.context, { ...data, ...extra });
  }

  /** Fetch available payment methods. Returns empty list if endpoint returns 404. */
  protected async fetchPaymentMethods(): Promise<HclWcsPaymentMethodsResponse> {
    const data = await this.client.callGet<HclWcsPaymentMethodsResponse>(
      `${this.client.transactionBaseUrl}/cart/@self/payment_instruction/eligible_payment_info`,
      undefined,
      { allowUndefined: true },
    );
    return data ?? { usablePaymentInformation: [] };
  }

  /** Add a payment instruction to the cart. */
  protected async fetchAddPaymentInstruction(body: {
    payMethodId: string;
    piAmount?: string;
    protocolData?: { name: string; value: string }[];
    billing_address_id?: string;
    billto_firstName?: string;
    billto_lastName?: string;
    billto_address1?: string;
    billto_city?: string;
    billto_state?: string;
    billto_zipCode?: string;
    billto_country?: string;
    billto_phone1?: string;
    billto_email1?: string;
  }): Promise<{ piId: string }> {
    return this.client.callPost<{ piId: string }>(
      `${this.client.transactionBaseUrl}/cart/@self/payment_instruction`,
      body,
    );
  }

  /** Delete a payment instruction from the cart. */
  protected async fetchDeletePaymentInstruction(piId: string): Promise<void> {
    return this.client.callDelete(
      `${this.client.transactionBaseUrl}/cart/@self/payment_instruction/${encodeURIComponent(piId)}`,
      { ignore404: true },
    );
  }

  /** Fetch available shipping modes. */
  protected async fetchShippingModes(): Promise<HclWcsShipModesResponse> {
    const params = new URLSearchParams();
    params.set('profileName', 'IBM_usableShippingMode');
    return this.client.callGet<HclWcsShipModesResponse>(
      `${this.client.transactionBaseUrl}/cart/@self/shipping_info`,
      params,
    );
  }

  /** Set the shipping mode (and optionally inline address) on the cart. */
  protected async fetchSetShippingInfo(body: {
    shipModeId?: string;
    orderItemId?: string[];
    x_addr?: HclWcsAddress;
  }): Promise<HclWcsOrderIdContainer> {
    return this.client.callPut<HclWcsOrderIdContainer>(
      `${this.client.transactionBaseUrl}/cart/@self/shipping_info`,
      {
        ...body,
        x_calculateOrder: '1',
        x_calculationUsage: '-1,-2,-3,-4,-5,-6,-7',
      },
    );
  }

  /** Set an inline shipping address on each order item. */
  protected async fetchSetShippingAddressForItems(
    orderItemIds: string[],
    addr: HclWcsAddress,
  ): Promise<HclWcsOrderIdContainer> {
    return this.client.callPut<HclWcsOrderIdContainer>(
      `${this.client.transactionBaseUrl}/cart/@self/shipping_info`,
      {
        x_calculateOrder: '1',
        x_calculationUsage: '-1,-2,-3,-4,-5,-6,-7',
        orderItem: orderItemIds.map((orderItemId) => ({
          orderItemId,
          x_addr: addr,
        })),
      },
    );
  }

  /** Pre-checkout validation — must be called before fetchSubmitCheckout(). */
  protected async fetchPrecheckout(): Promise<HclWcsOrderIdContainer> {
    return this.client.callPut<HclWcsOrderIdContainer>(
      `${this.client.transactionBaseUrl}/cart/@self/precheckout`,
      {},
    );
  }

  /** Submit the cart as an order. */
  protected async fetchSubmitCheckout(): Promise<HclWcsOrderIdContainer> {
    return this.client.callPost<HclWcsOrderIdContainer>(
      `${this.client.transactionBaseUrl}/cart/@self/checkout`,
      {},
    );
  }

  @Reactionary({
    inputSchema: CheckoutMutationInitiateCheckoutSchema,
    outputSchema: CheckoutSchema,
  })
  public override async initiateCheckoutForCart(
    payload: CheckoutMutationInitiateCheckout,
  ): Promise<Result<CheckoutFactoryCheckoutOutput<TFactory>>> {
    debug('initiateCheckoutForCart orderId=%s', payload.cart.identifier.key);
    // Store notification email in session so parseCheckout can use it
    // as the pointOfContact.email when no billing address is present.
    if (payload.notificationEmail) {
      this.context.session['hcl.notificationEmail'] = payload.notificationEmail;
    }
    // In WCS, the cart IS the checkout — there is no separate checkout entity.
    // To seed billing address (following the perpendicular pattern), we add a
    // placeholder payment instruction that carries the billing address inline.
    // This PI will be replaced when the user later calls addPaymentInstruction
    // with their actual payment method (perpendicular's upsertBillingAddress
    // does exactly the same: delete-then-add).
    if (payload.billingAddress) {
      const addr = payload.billingAddress;

      // Get the first available payment method to use as a placeholder.
      const methodsResp = await this.fetchPaymentMethods();
      const firstMethod = methodsResp.usablePaymentInformation?.[0];

      if (firstMethod) {
        // Delete any existing PIs first (mirrors upsertBillingAddress).
        const cartData = await this.fetchWcsCart();
        for (const pi of cartData.paymentInstruction ?? []) {
          await this.fetchDeletePaymentInstruction(pi.piId);
        }

        await this.fetchAddPaymentInstruction({
          payMethodId: firstMethod.paymentMethodName,
          billto_firstName: addr.firstName,
          billto_lastName: addr.lastName,
          billto_address1: `${addr.streetAddress} ${addr.streetNumber}`.trim(),
          billto_city: addr.city,
          billto_state: addr.region,
          billto_zipCode: addr.postalCode,
          billto_country: addr.countryCode,
          billto_phone1: payload.notificationPhone,
          billto_email1: payload.notificationEmail,
        });
      }
    }
    return success(await this.fetchCheckout());
  }

  @Reactionary({
    inputSchema: CheckoutQueryByIdSchema,
    outputSchema: CheckoutSchema,
  })
  public override async getById(
    _payload: CheckoutQueryById,
  ): Promise<Result<CheckoutFactoryCheckoutOutput<TFactory>, NotFoundError>> {
    debug('getById');
    try {
      return success(await this.fetchCheckout());
    } catch (err) {
      if (err instanceof HclCartNotFoundError) {
        return error<NotFoundError>({ type: 'NotFound', identifier: '' });
      }
      throw err;
    }
  }

  @Reactionary({
    inputSchema: CheckoutMutationSetShippingAddressSchema,
    outputSchema: CheckoutSchema,
  })
  public override async setShippingAddress(
    payload: CheckoutMutationSetShippingAddress,
  ): Promise<Result<CheckoutFactoryCheckoutOutput<TFactory>>> {
    debug('setShippingAddress');
    // Fetch the cart to get all current orderItemIds (required by WCS shipping_info endpoint).
    const cartData = await this.fetchWcsCart();
    const orderItemIds = (cartData.orderItem ?? []).map((i) => i.orderItemId);
    const addr = payload.shippingAddress;
    await this.fetchSetShippingAddressForItems(orderItemIds, {
      firstName: addr.firstName,
      lastName: addr.lastName,
      address1: `${addr.streetAddress} ${addr.streetNumber}`.trim(),
      city: addr.city,
      state: addr.region,
      zipCode: addr.postalCode,
      country: addr.countryCode,
    });
    return success(await this.fetchCheckout());
  }

  @Reactionary({
    inputSchema: CheckoutQueryForAvailableShippingMethodsSchema,
    outputSchema: ShippingMethodSchema.array(),
  })
  public override async getAvailableShippingMethods(
    _payload: CheckoutQueryForAvailableShippingMethods,
  ): Promise<Result<CheckoutFactoryShippingMethodOutput<TFactory>[]>> {
    debug('getAvailableShippingMethods');
    const response = await this.fetchShippingModes();
    // Newer WCS returns usableShippingMode at root; older WCS embeds modes in orderItem.
    let modes: CheckoutFactoryShippingMethodOutput<TFactory>[];
    if (response.usableShippingMode && response.usableShippingMode.length > 0) {
      modes = response.usableShippingMode.map((mode) =>
        this.factory.parseShippingMethod(this.context, mode),
      );
    } else {
      // Extract unique shipping modes from orderItem (deduplicated by shipModeId).
      const seen = new Set<string>();
      modes = [];
      for (const item of response.orderItem ?? []) {
        if (item.shipModeId && !seen.has(item.shipModeId)) {
          seen.add(item.shipModeId);
          modes.push(
            this.factory.parseShippingMethod(this.context, {
              shipModeId: item.shipModeId,
              carrier: item.carrier ?? '',
              shipModeCode: item.shipModeCode ?? '',
              shipModeDescription:
                item.shipModeDescription ??
                item.description ??
                item.shipModeCode ??
                '',
            }),
          );
        }
      }
    }
    return success(modes);
  }

  @Reactionary({
    inputSchema: CheckoutQueryForAvailablePaymentMethodsSchema,
    outputSchema: PaymentMethodSchema.array(),
  })
  public override async getAvailablePaymentMethods(
    _payload: CheckoutQueryForAvailablePaymentMethods,
  ): Promise<Result<CheckoutFactoryPaymentMethodOutput<TFactory>[]>> {
    debug('getAvailablePaymentMethods');
    const response = await this.fetchPaymentMethods();
    const methods = (response.usablePaymentInformation ?? []).map((method) =>
      this.factory.parsePaymentMethod(this.context, method),
    );
    return success(methods);
  }

  @Reactionary({
    inputSchema: CheckoutMutationAddPaymentInstructionSchema,
    outputSchema: CheckoutSchema,
  })
  public override async addPaymentInstruction(
    payload: CheckoutMutationAddPaymentInstruction,
  ): Promise<Result<CheckoutFactoryCheckoutOutput<TFactory>>> {
    debug(
      'addPaymentInstruction payMethodId=%s',
      payload.paymentInstruction.paymentMethod.method,
    );
    await this.fetchAddPaymentInstruction({
      payMethodId: payload.paymentInstruction.paymentMethod.method,
      piAmount: payload.paymentInstruction.amount
        ? String(payload.paymentInstruction.amount.value)
        : undefined,
      protocolData: payload.paymentInstruction.protocolData.map((pd) => ({
        name: pd.key,
        value: pd.value,
      })),
    });
    return success(await this.fetchCheckout());
  }

  @Reactionary({
    inputSchema: CheckoutMutationRemovePaymentInstructionSchema,
    outputSchema: CheckoutSchema,
  })
  public override async removePaymentInstruction(
    payload: CheckoutMutationRemovePaymentInstruction,
  ): Promise<Result<CheckoutFactoryCheckoutOutput<TFactory>>> {
    debug('removePaymentInstruction piId=%s', payload.paymentInstruction.key);
    await this.fetchDeletePaymentInstruction(payload.paymentInstruction.key);
    return success(await this.fetchCheckout());
  }

  @Reactionary({
    inputSchema: CheckoutMutationSetShippingInstructionSchema,
    outputSchema: CheckoutSchema,
  })
  public override async setShippingInstruction(
    payload: CheckoutMutationSetShippingInstruction,
  ): Promise<Result<CheckoutFactoryCheckoutOutput<TFactory>>> {
    debug(
      'setShippingInstruction shipModeId=%s',
      payload.shippingInstruction.shippingMethod.key,
    );
    // Fetch the cart to get all current orderItemIds.
    const cartData = await this.fetchWcsCart();
    const orderItemIds = (cartData.orderItem ?? []).map((i) => i.orderItemId);

    await this.fetchSetShippingInfo({
      shipModeId: payload.shippingInstruction.shippingMethod.key,
      orderItemId: orderItemIds,
    });
    return success(await this.fetchCheckout());
  }

  @Reactionary({
    inputSchema: CheckoutMutationFinalizeCheckoutSchema,
    outputSchema: CheckoutSchema,
  })
  public override async finalizeCheckout(
    _payload: CheckoutMutationFinalizeCheckout,
  ): Promise<Result<CheckoutFactoryCheckoutOutput<TFactory>>> {
    debug('finalizeCheckout');
    // Save cart state before submission (after checkout the cart is gone).
    const cartBefore = await this.fetchWcsCart();

    await this.fetchPrecheckout();
    const result = await this.fetchSubmitCheckout();

    // In WCS, the orderId returned by checkout IS the same as the cart orderId
    // (same entity, status changed from 'P' to 'C').
    const checkout = this.factory.parseCheckout(this.context, {
      ...cartBefore,
      resultingOrderKey: result.orderId,
    } as HclWcsCartResponse & { resultingOrderKey?: string });
    return success(checkout);
  }
}
