import type { Address as CTAddress, Cart as CTCart, Payment as CTPayment, ShippingMethod as CTShippingMethod, LineItem, MyCartUpdateAction } from '@commercetools/platform-sdk';
import type {
  Address,
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
  MonetaryAmount,
  NotFoundError,
  PaymentInstruction,
  PaymentInstructionIdentifier,
  PaymentMethod,
  PaymentMethodIdentifier,
  PaymentStatus,
  RequestContext,
  Result,
  ShippingInstruction,
  ShippingMethod,
  ShippingMethodIdentifier,
} from '@reactionary/core';
import {
  CheckoutItemSchema,
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
  PaymentMethodSchema,
  Reactionary,
  ShippingMethodSchema,
  success,
  error,
  unwrapValue
} from '@reactionary/core';
import z from 'zod';
import type { CommercetoolsAPI } from '../core/client.js';
import {
  type CommercetoolsCartIdentifier,
  type CommercetoolsCheckoutIdentifier,
} from '../schema/commercetools.schema.js';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';

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

export class CommercetoolsCheckoutProvider extends CheckoutProvider {
  protected config: CommercetoolsConfiguration;
  protected commercetools: CommercetoolsAPI;

  constructor(
    config: CommercetoolsConfiguration,
    cache: Cache,
    context: RequestContext,
    commercetools: CommercetoolsAPI
  ) {
    super(cache, context);

    this.config = config;
    this.commercetools = commercetools;
  }

  protected async getClient() {
    const client = await this.commercetools.getClient();

    return {
      payments: client
        .withProjectKey({ projectKey: this.config.projectKey })
        .me()
        .payments(),
      carts: client
        .withProjectKey({ projectKey: this.config.projectKey })
        .me()
        .carts(),
      shippingMethods: client
        .withProjectKey({ projectKey: this.config.projectKey })
        .shippingMethods(),
      orders: client
        .withProjectKey({ projectKey: this.config.projectKey })
        .me()
        .orders(),
    };
  }

  @Reactionary({
    inputSchema: CheckoutMutationInitiateCheckoutSchema,
    outputSchema: CheckoutSchema,
  })
  public async initiateCheckoutForCart(
    payload: CheckoutMutationInitiateCheckout
  ): Promise<Result<Checkout>> {
    // so......we could copy the cart......

    const client = await this.getClient();

    const cart = await client.carts
      .withId({ ID: payload.cart.identifier.key })
      .get()
      .execute();
    const replicationResponse = await client.carts
      .replicate()
      .post({
        body: {
          reference: {
            typeId: 'cart',
            id: cart.body.id,
          },
        },
      })
      .execute();
    // set the custom type to mark it as a checkout

    const actions: MyCartUpdateAction[] = [
      {
        action: 'setCustomType',
        type: {
          typeId: 'type',
          key: 'reactionaryCheckout',
        },
        fields: {
          commerceToolsCartId: payload.cart.identifier.key,
        },
      },
    ];

    if (payload.billingAddress) {
      actions.push({
        action: 'setBillingAddress',
        address: {
          country: payload.billingAddress.countryCode,
          firstName: payload.billingAddress.firstName || '',
          lastName: payload.billingAddress.lastName || '',
          streetName: payload.billingAddress.streetAddress || '',
          streetNumber: payload.billingAddress.streetNumber || '',
          postalCode: payload.billingAddress.postalCode || '',
          city: payload.billingAddress.city || '',
          email: payload.notificationEmail || '',
          phone: payload.notificationPhone || '',
        },
      });
      actions.push({
        action: 'setShippingAddress',
        address: {
          country: payload.billingAddress.countryCode,
          firstName: payload.billingAddress.firstName || '',
          lastName: payload.billingAddress.lastName || '',
          streetName: payload.billingAddress.streetAddress || '',
          streetNumber: payload.billingAddress.streetNumber || '',
          postalCode: payload.billingAddress.postalCode || '',
          city: payload.billingAddress.city || '',
        },
      });
    }

    const checkoutResponse = await client.carts
      .withId({ ID: replicationResponse.body.id })
      .post({
        body: {
          version: replicationResponse.body.version || 0,
          actions: [...actions],
        },
      })
      .execute();

    return success(this.parseSingle(checkoutResponse.body));
  }

  @Reactionary({
    inputSchema: CheckoutQueryByIdSchema,
    outputSchema: CheckoutSchema.nullable(),
  })
  public async getById(payload: CheckoutQueryById): Promise<Result<Checkout, NotFoundError>> {
    const client = await this.getClient();
    const checkoutResponse = await client.carts
      .withId({ ID: payload.identifier.key })
      .get({
        queryArgs: {
          expand: ['paymentInfo.payments[*]', 'shippingInfo.shippingMethod'],
        },
      })
      .execute();

    const checkout = this.parseSingle(checkoutResponse.body);

    if (checkoutResponse.body.cartState === 'Ordered') {
      const order = await client.orders
        .get({
          queryArgs: {
            where: `cart(id="${checkout.identifier.key}")`,
          },
        })
        .execute();

      checkout.resultingOrder = {
        key: order.body.results[0].id,
      };
    }

    return success(checkout);
  }

  @Reactionary({
    inputSchema: CheckoutMutationSetShippingAddressSchema,
    outputSchema: CheckoutSchema,
  })
  public async setShippingAddress(
    payload: CheckoutMutationSetShippingAddress
  ): Promise<Result<Checkout>> {
    const client = await this.getClient();

    const version = (payload.checkout as CommercetoolsCheckoutIdentifier)
      .version;
    const checkoutResponse = await client.carts
      .withId({ ID: payload.checkout.key })
      .post({
        body: {
          version: version,
          actions: [
            {
              action: 'setShippingAddress',
              address: {
                country: payload.shippingAddress.countryCode,
                firstName: payload.shippingAddress.firstName || '',
                lastName: payload.shippingAddress.lastName || '',
                streetName: payload.shippingAddress.streetAddress || '',
                streetNumber: payload.shippingAddress.streetNumber || '',
                postalCode: payload.shippingAddress.postalCode || '',
                city: payload.shippingAddress.city || '',
              },
            },
          ],
        },
      })
      .execute();

    return success(this.parseSingle(checkoutResponse.body));
  }

  @Reactionary({
    inputSchema: CheckoutQueryForAvailableShippingMethodsSchema,
    outputSchema: z.array(ShippingMethodSchema),
  })
  public async getAvailableShippingMethods(
    payload: CheckoutQueryForAvailableShippingMethods
  ): Promise<Result<ShippingMethod[]>> {
    const client = await this.getClient();
    const shippingMethodsResponse = await client.shippingMethods
      .matchingCart()
      .get({
        queryArgs: {
          cartId: payload.checkout.key,
        },
      })
      .execute();

    const result: Array<ShippingMethod> = [];
    const inputShippingMethods: CTShippingMethod[] = shippingMethodsResponse
      .body.results as CTShippingMethod[];
    for (const sm of inputShippingMethods) {
      const identifier = {
        key: sm.key!,
      } satisfies ShippingMethodIdentifier;
      const name = sm.name;
      const description = sm.localizedDescription?.[this.context.languageContext.locale] || '';
      const shippingMethod = {
        deliveryTime: '',
        description,
        identifier,
        name,
        price: sm.zoneRates[0].shippingRates[0].price
          ? {
              value:
                (sm.zoneRates[0].shippingRates[0].price.centAmount || 0) / 100,
              currency:
                sm.zoneRates[0].shippingRates[0].price.currencyCode as Currency ||
                this.context.languageContext.currencyCode,
            }
          : { value: 0, currency: this.context.languageContext.currencyCode },
      } satisfies ShippingMethod;

      result.push(shippingMethod);
    }
    return success(result);
  }

  @Reactionary({
    inputSchema: CheckoutQueryForAvailablePaymentMethodsSchema,
    outputSchema: z.array(PaymentMethodSchema),
  })
  public async getAvailablePaymentMethods(
    payload: CheckoutQueryForAvailablePaymentMethods
  ): Promise<Result<PaymentMethod[]>> {
    // Commercetools does not have a concept of payment methods, as these are handled by the payment providers.
    // So for now, we will return an empty array.
    const staticMethods = this.getStaticPaymentMethods(payload.checkout);

    const dynamicMethods: PaymentMethod[] = [];
    // later we will also fetch any stored payment methods the user has...

    return success([...staticMethods, ...dynamicMethods]);
  }

  @Reactionary({
    inputSchema: CheckoutMutationAddPaymentInstructionSchema,
    outputSchema: CheckoutSchema,
  })
  public async addPaymentInstruction(
    payload: CheckoutMutationAddPaymentInstruction
  ): Promise<Result<Checkout>> {
    const client = await this.getClient();

    const response = await client.payments
      .post({
        body: {
          amountPlanned: {
            centAmount: Math.round(
              payload.paymentInstruction.amount.value * 100
            ),
            currencyCode: payload.paymentInstruction.amount.currency,
          },
          paymentMethodInfo: {
            method: payload.paymentInstruction.paymentMethod.method,
            name: {
              [this.context.languageContext.locale]:
                payload.paymentInstruction.paymentMethod.name,
            },
            paymentInterface:
              payload.paymentInstruction.paymentMethod.paymentProcessor,
          },
          custom: {
            type: {
              typeId: 'type',
              key: 'reactionaryPaymentCustomFields',
            },
            fields: {
              commerceToolsCartId: payload.checkout.key,
            },
          },
        },
      })
      .execute();

    const version = (payload.checkout as CommercetoolsCheckoutIdentifier)
      .version;
    const actions: MyCartUpdateAction[] = [
      {
        action: 'addPayment',
        payment: {
          typeId: 'payment',
          id: response.body.id,
        },
      },
    ];

    const result = await this.applyActions(
      payload.checkout as CommercetoolsCheckoutIdentifier,
      actions
    );

    return success(result);
  }

  @Reactionary({
    inputSchema: CheckoutMutationRemovePaymentInstructionSchema,
    outputSchema: CheckoutSchema,
  })
  public async removePaymentInstruction(
    payload: CheckoutMutationRemovePaymentInstruction
  ): Promise<Result<Checkout>> {
    const client = await this.getClient();

    // FIXME: Need to get full-endpoint rights, if we want to cancel the authorization on the payment. The MyPayment endpoint does not support
    // changing a payment intent after it has transactions.

    // get newest version
    /*
    const newestVersion = await client.payments.withId({ ID: payload.paymentInstruction.key }).get().execute();

    const cancelledVersion = await client.payments.withId({ ID: payload.paymentInstruction.key }).post({
      body: {
        version: newestVersion.body.version || 0,
        actions: [
          {
            action: "addTransaction",
            transaction: {
              type: "CancelAuthorization",
              amount: newestVersion.body.amountPlanned,
            }
          }
        ]
      }
    }).execute();
    */
    // we set the planned amount to 0, which effectively cancels the payment, and also allows the backend to clean it up.
    // Note: This does NOT remove the payment from the cart, as that would be a breaking change to the cart, and we want to avoid that during checkout.
    // Instead, the payment will remain on the cart, but with status 'canceled', and can be removed later if needed.
    // This also allows us to keep a record of the payment instruction for auditing purposes.
    // The cart can be re-used, and a new payment instruction can be added to it later.
    // The frontend should ignore any payment instructions with status 'canceled' when displaying payment options to the user.

    // Now add the payment to the cart
    /*
    const ctId = payload.checkout as CommercetoolsCheckoutIdentifier
    const updatedCart = await client.carts.withId({ ID: ctId.key }).post({
      body: {
        version: ctId.version,
        actions: [
          {
            'action': 'removePayment',
            'payment': {
              'typeId': 'payment',
              'id': payload.paymentInstruction.key
            }
          }
        ]
      }
    }).execute();

    const response = await client.payments.withId({ ID: payload.paymentInstruction.key }).delete({
      queryArgs: {
        version: newestVersion.body.version || 0
      }
    }).execute();
    */

    const checkout = unwrapValue(await this.getById({ identifier: payload.checkout }));
    return success(checkout);
  }

  @Reactionary({
    inputSchema: CheckoutMutationSetShippingInstructionSchema,
    outputSchema: CheckoutSchema,
  })
  public async setShippingInstruction(
    payload: CheckoutMutationSetShippingInstruction
  ): Promise<Result<Checkout>> {
    const actions: MyCartUpdateAction[] = [];
    actions.push({
      action: 'setShippingMethod',
      shippingMethod: {
        typeId: 'shipping-method',
        key: payload.shippingInstruction.shippingMethod.key,
      },
    });
    actions.push({
      action: 'setCustomField',
      name: 'shippingInstruction',
      value: payload.shippingInstruction.instructions,
    });
    actions.push({
      action: 'setCustomField',
      name: 'consentForUnattendedDelivery',
      value: payload.shippingInstruction.consentForUnattendedDelivery + '',
    });
    actions.push({
      action: 'setCustomField',
      name: 'pickupPointId',
      value: payload.shippingInstruction.pickupPoint,
    });

    const result = await this.applyActions(
      payload.checkout as CommercetoolsCheckoutIdentifier,
      actions
    );

    return success(result);
  }

  @Reactionary({
    inputSchema: CheckoutMutationFinalizeCheckoutSchema,
    outputSchema: CheckoutSchema,
  })
  public async finalizeCheckout(
    payload: CheckoutMutationFinalizeCheckout
  ): Promise<Result<Checkout>> {
    const checkout = await this.getById({ identifier: payload.checkout });
    if (!checkout.success || !checkout.value.readyForFinalization) {
      throw new CheckoutNotReadyForFinalizationError(payload.checkout);
    }

    const client = await this.getClient();
    const ctId = payload.checkout as CommercetoolsCheckoutIdentifier;

    // create the order from the cart
    const orderResponse = await client.orders
      .post({
        body: {
          id: ctId.key,
          version: ctId.version,
        },
      })
      .execute();

    return this.getById({
      identifier: payload.checkout,
    }) as unknown as Result<Checkout>;
  }

  protected async applyActions(
    checkout: CheckoutIdentifier,
    actions: MyCartUpdateAction[]
  ): Promise<Checkout> {
    const client = await this.getClient();
    const ctId = checkout as CommercetoolsCheckoutIdentifier;

    try {
      const response = await client.carts
        .withId({ ID: ctId.key })
        .post({
          queryArgs: {
            expand: ['paymentInfo.payments[*]', 'shippingInfo.shippingMethod'],
          },
          body: {
            version: ctId.version,
            actions,
          },
        })
        .execute();

      if (response.error) {
        console.error(response.error);
      }

      const p = this.parseSingle(response.body);

      return p;
    } catch (e: any) {
      console.error('Error applying actions to cart:', e);
      throw e;
    }
  }

  /**
   * Extension point, to allow filtering the options, or adding new ones, like invoicing for b2b.
   *
   * Usecase: Override this, if you need to change the payment options based on the request context.
   * @returns
   */
  protected getStaticPaymentMethods(
    _checkout: CheckoutIdentifier
  ): PaymentMethod[] {
    return this.config.paymentMethods || [];
  }

  protected parseCheckoutItem(remoteItem: LineItem): CheckoutItem {
    const unitPrice = remoteItem.price.value.centAmount;
    const totalPrice = remoteItem.totalPrice.centAmount || 0;
    const totalDiscount = remoteItem.price.discounted?.value.centAmount || 0;
    const unitDiscount = totalDiscount / remoteItem.quantity;
    const currency =
      remoteItem.price.value.currencyCode.toUpperCase() as Currency;

    const item = {
      identifier: {
        key: remoteItem.id,
      },
      variant: {
        sku: remoteItem.variant.sku || '',
      },
      quantity: remoteItem.quantity,
      price: {
        unitPrice: {
          value: unitPrice / 100,
          currency,
        },
        unitDiscount: {
          value: unitDiscount / 100,
          currency,
        },
        totalPrice: {
          value: (totalPrice || 0) / 100,
          currency,
        },
        totalDiscount: {
          value: totalDiscount / 100,
          currency,
        },
      },
    } satisfies CheckoutItem;

    return CheckoutItemSchema.parse(item);
  }

  protected parseSingle(remote: CTCart): Checkout {
    const identifier = {
      key: remote.id,
      version: remote.version || 0,
    } satisfies CommercetoolsCheckoutIdentifier;

    const originalCartReference = {
      key: remote.custom?.fields['commerceToolsCartId'] || '',
      version: 0,
    } satisfies CommercetoolsCartIdentifier;

    let shippingAddress: Address | undefined;
    if (remote.shippingAddress) {
      shippingAddress = this.parseAddress(remote.shippingAddress);
    }

    let billingAddress: Address | undefined;
    if (remote.billingAddress) {
      billingAddress = this.parseAddress(remote.billingAddress);
    }

    const paymentInstructions = new Array<PaymentInstruction>();
    for (const p of remote.paymentInfo?.payments || []) {
      if (p.obj) {
        paymentInstructions.push(this.parsePaymentInstruction(p.obj));
      }
    }

    const grandTotal = remote.totalPrice.centAmount || 0;
    const shippingTotal = remote.shippingInfo?.price.centAmount || 0;
    const productTotal = grandTotal - shippingTotal;
    const taxTotal = remote.taxedPrice?.totalTax?.centAmount || 0;
    const discountTotal =
      remote.discountOnTotalPrice?.discountedAmount.centAmount || 0;
    const surchargeTotal = 0;
    const currency = remote.totalPrice.currencyCode as Currency;

    const price = {
      totalTax: {
        value: taxTotal / 100,
        currency,
      },
      totalDiscount: {
        value: discountTotal / 100,
        currency,
      },
      totalSurcharge: {
        value: surchargeTotal / 100,
        currency,
      },
      totalShipping: {
        value: shippingTotal / 100,
        currency: currency
      },
      totalProductPrice: {
        value: productTotal / 100,
        currency,
      },
      grandTotal: {
        value: grandTotal / 100,
        currency,
      },
    } satisfies CostBreakDown;

    const items = new Array<CheckoutItem>();
    for (const remoteItem of remote.lineItems) {
      const item = this.parseCheckoutItem(remoteItem);
      items.push(item);
    }

    const shippingInstruction = this.parseShippingInstruction(remote);
    const readyForFinalization = this.isReadyForFinalization(
      price,
      paymentInstructions,
      billingAddress,
      shippingAddress,
      shippingInstruction
    );

    const result = {
      identifier,
      originalCartReference,
      name: remote.custom?.fields['name'] || '',
      description: remote.custom?.fields['description'] || '',
      readyForFinalization,
      billingAddress,
      shippingAddress,
      shippingInstruction,
      paymentInstructions,
      items,
      price,
    } satisfies Checkout;

    return result;
  }

  protected isReadyForFinalization(
    price: CostBreakDown,
    paymentInstructions: Array<PaymentInstruction>,
    billingAddress?: Address,
    shippingAddress?: Address,
    shippingInstruction?: ShippingInstruction
  ): boolean {
    // we should have a billing address
    if (!billingAddress) return false;

    // we should know how to ship it
    if (!shippingInstruction) return false;

    // and it should ship either to an address or a pickup point
    if (!shippingAddress && !shippingInstruction.pickupPoint) return false;

    // and it should be paid for
    if (paymentInstructions.length === 0) return false;

    const authorizedPayments = paymentInstructions
      .filter((pi) => pi.status === 'authorized')
      .map((x) => x.amount.value)
      .reduce((a, b) => a + b, 0);
    if (price.grandTotal.value !== authorizedPayments) return false;

    return true;
  }

  protected parsePaymentInstruction(remote: CTPayment): PaymentInstruction {
    const identifier = {
      key: remote.id,
    } satisfies PaymentInstructionIdentifier;
    const amount = {
      value: remote.amountPlanned.centAmount / 100,
      currency: remote.amountPlanned.currencyCode as Currency,
    } satisfies MonetaryAmount;

    const method = remote.paymentMethodInfo?.method || 'unknown';
    const paymentProcessor =
      remote.paymentMethodInfo?.paymentInterface || method;
    const paymentName =
      remote.paymentMethodInfo.name![this.context.languageContext.locale];

    const paymentMethod = {
      method,
      paymentProcessor,
      name: paymentName || method || 'Unknown',
    } satisfies PaymentMethodIdentifier;

    const customData = remote.custom?.fields || {};
    const protocolData =
      Object.keys(customData).map((x) => ({ key: x, value: customData[x] })) ||
      [];

    let status: PaymentStatus = 'pending';
    if (remote.transactions && remote.transactions.length > 0) {
      const lastTransaction =
        remote.transactions[remote.transactions.length - 1];
      if (
        lastTransaction.type === 'Authorization' &&
        lastTransaction.state === 'Pending'
      ) {
        status = 'pending';
      } else if (
        lastTransaction.type === 'Authorization' &&
        lastTransaction.state === 'Success'
      ) {
        status = 'authorized';
      }
    } else {
      status = 'pending';
    }

    const result = {
      amount,
      identifier,
      paymentMethod,
      protocolData,
      status
    } satisfies PaymentInstruction;

    return result;
  }

  protected parseAddress(remote: CTAddress) {
    return {
      countryCode: remote.country || '',
      firstName: remote.firstName || '',
      lastName: remote.lastName || '',
      streetAddress: remote.streetName || '',
      streetNumber: remote.streetNumber || '',
      postalCode: remote.postalCode || '',
      city: remote.city || '',
      identifier: {
        nickName: '',
      },
      region: '',
    } satisfies Address;
  }

  protected parseShippingInstruction(
    remote: CTCart
  ): ShippingInstruction | undefined {
    if (!remote.shippingInfo) return undefined;

    const instructions = remote.custom?.fields['shippingInstruction'] || '';
    const consentForUnattendedDelivery =
      remote.custom?.fields['consentForUnattendedDelivery'] === 'true' || false;
    const pickupPoint = remote.custom?.fields['pickupPointId'] || '';

    const shippingInstruction = {
      shippingMethod: {
        key: remote.shippingInfo.shippingMethod?.obj?.key || '',
      },
      pickupPoint: pickupPoint || '',
      instructions: instructions || '',
      consentForUnattendedDelivery: consentForUnattendedDelivery || false,
    } satisfies ShippingInstruction;

    return shippingInstruction;
  }
}
