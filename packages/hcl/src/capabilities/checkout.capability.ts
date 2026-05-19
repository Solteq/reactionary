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
import type { HclTransactionClient } from '../core/transaction-client.js';
import {
  HclCartNotFoundError,
  getWcsAuthFromContext,
} from '../core/transaction-client.js';
import type { HclCheckoutFactory } from '../factories/checkout/checkout.factory.js';
import { getLocaleParams } from '../core/locale-params.js';
import type { HclWcsCartResponse } from '../schema/hcl.schema.js';
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
  protected transactionClient: HclTransactionClient;
  protected factory: CheckoutFactoryWithOutput<TFactory>;

  constructor(
    cache: Cache,
    context: RequestContext,
    config: HclConfiguration,
    transactionClient: HclTransactionClient,
    factory: CheckoutFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.transactionClient = transactionClient;
    this.factory = factory;
  }

  /** Fetch the active cart and parse it as a Checkout. */
  private async fetchCheckout(
    extra?: Partial<HclWcsCartResponse & { resultingOrderKey?: string }>,
  ): Promise<CheckoutFactoryCheckoutOutput<TFactory>> {
    const auth = getWcsAuthFromContext(this.context);
    const { currency } = getLocaleParams(this.config, this.context);
    const data = await this.transactionClient.getCart({ currency }, auth);
    return this.factory.parseCheckout(this.context, { ...data, ...extra });
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
      const auth = getWcsAuthFromContext(this.context);
      const addr = payload.billingAddress;

      // Get the first available payment method to use as a placeholder.
      const methodsResp = await this.transactionClient.getPaymentMethods(auth);
      const firstMethod = methodsResp.usablePaymentInformation?.[0];

      if (firstMethod) {
        // Delete any existing PIs first (mirrors upsertBillingAddress).
        const cartData = await this.transactionClient.getCart(undefined, auth);
        for (const pi of cartData.paymentInstruction ?? []) {
          await this.transactionClient.deletePaymentInstruction(pi.piId, auth);
        }

        await this.transactionClient.addPaymentInstruction(
          {
            payMethodId: firstMethod.paymentMethodName,
            billto_firstName: addr.firstName,
            billto_lastName: addr.lastName,
            billto_address1:
              `${addr.streetAddress} ${addr.streetNumber}`.trim(),
            billto_city: addr.city,
            billto_state: addr.region,
            billto_zipCode: addr.postalCode,
            billto_country: addr.countryCode,
            billto_phone1: payload.notificationPhone,
            billto_email1: payload.notificationEmail,
          },
          auth,
        );
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
    const auth = getWcsAuthFromContext(this.context);
    // Fetch the cart to get all current orderItemIds (required by WCS shipping_info endpoint).
    const { currency } = getLocaleParams(this.config, this.context);
    const cartData = await this.transactionClient.getCart({ currency }, auth);
    const orderItemIds = (cartData.orderItem ?? []).map((i) => i.orderItemId);
    const addr = payload.shippingAddress;
    await this.transactionClient.setShippingAddressForItems(
      orderItemIds,
      {
        firstName: addr.firstName,
        lastName: addr.lastName,
        address1: `${addr.streetAddress} ${addr.streetNumber}`.trim(),
        city: addr.city,
        state: addr.region,
        zipCode: addr.postalCode,
        country: addr.countryCode,
      },
      auth,
    );
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
    const auth = getWcsAuthFromContext(this.context);
    const { langId } = getLocaleParams(this.config, this.context);
    const response = await this.transactionClient.getShippingModes(
      { langId },
      auth,
    );
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
                item.shipModeDescription ?? item.description ?? item.shipModeCode ?? '',
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
    const auth = getWcsAuthFromContext(this.context);
    const response = await this.transactionClient.getPaymentMethods(auth);
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
    const auth = getWcsAuthFromContext(this.context);
    await this.transactionClient.addPaymentInstruction(
      {
        payMethodId: payload.paymentInstruction.paymentMethod.method,
        piAmount: payload.paymentInstruction.amount
          ? String(payload.paymentInstruction.amount.value)
          : undefined,
        protocolData: payload.paymentInstruction.protocolData.map((pd) => ({
          name: pd.key,
          value: pd.value,
        })),
      },
      auth,
    );
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
    const auth = getWcsAuthFromContext(this.context);
    await this.transactionClient.deletePaymentInstruction(
      payload.paymentInstruction.key,
      auth,
    );
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
    const auth = getWcsAuthFromContext(this.context);
    // Fetch the cart to get all current orderItemIds.
    const { currency } = getLocaleParams(this.config, this.context);
    const cartData = await this.transactionClient.getCart({ currency }, auth);
    const orderItemIds = (cartData.orderItem ?? []).map((i) => i.orderItemId);

    await this.transactionClient.setShippingInfo(
      {
        shipModeId: payload.shippingInstruction.shippingMethod.key,
        orderItemId: orderItemIds,
      },
      auth,
    );
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
    const auth = getWcsAuthFromContext(this.context);
    // Save cart state before submission (after checkout the cart is gone).
    const { currency } = getLocaleParams(this.config, this.context);
    const cartBefore = await this.transactionClient.getCart({ currency }, auth);

    await this.transactionClient.precheckout(auth);
    const result = await this.transactionClient.checkout(auth);

    // In WCS, the orderId returned by checkout IS the same as the cart orderId
    // (same entity, status changed from 'P' to 'C').
    const checkout = this.factory.parseCheckout(this.context, {
      ...cartBefore,
      resultingOrderKey: result.orderId,
    } as HclWcsCartResponse & { resultingOrderKey?: string });
    return success(checkout);
  }
}
