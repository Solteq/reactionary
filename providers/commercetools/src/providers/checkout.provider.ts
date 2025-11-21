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
  PaymentInstruction,
} from '@reactionary/core';
import {
  AddressSchema,
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
  PaymentInstructionIdentifierSchema,
  PaymentInstructionSchema,
  PaymentMethodIdentifierSchema,
  PaymentMethodSchema,
  Reactionary,
  ShippingInstructionSchema,
  ShippingMethodSchema,
} from '@reactionary/core';
import z from 'zod';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type { ApiRoot, MyCartUpdateAction } from '@commercetools/platform-sdk';
import {
  CommercetoolsCartIdentifierSchema,
  CommercetoolsCheckoutIdentifierSchema,
  type CommercetoolsCheckoutIdentifier,
} from '../schema/commercetools.schema.js';
import type {
  Address as CTAddress,
  Payment as CTPayment,
  Cart as CTCart,
  ShippingMethod as CTShippingMethod,
} from '@commercetools/platform-sdk';
import type { CommercetoolsClient } from '../core/client.js';

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

export class CommercetoolsCheckoutProvider<
  T extends Checkout = Checkout
> extends CheckoutProvider<T> {
  protected config: CommercetoolsConfiguration;
  protected client: CommercetoolsClient;

  constructor(
    config: CommercetoolsConfiguration,
    schema: z.ZodType<T>,
    cache: Cache,
    context: RequestContext,
    client: CommercetoolsClient
  ) {
    super(schema, cache, context);

    this.config = config;
    this.client = client;
  }

  protected async getClient() {
    const client = await this.client.getClient();

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
  ): Promise<T> {
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

    return this.parseSingle(checkoutResponse.body);
  }

  @Reactionary({
    inputSchema: CheckoutQueryByIdSchema,
    outputSchema: CheckoutSchema.nullable(),
  })
  public async getById(payload: CheckoutQueryById): Promise<T | null> {
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

    return checkout;
  }

  @Reactionary({
    inputSchema: CheckoutMutationSetShippingAddressSchema,
    outputSchema: CheckoutSchema,
  })
  public async setShippingAddress(
    payload: CheckoutMutationSetShippingAddress
  ): Promise<T> {
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

    return this.parseSingle(checkoutResponse.body);
  }

  @Reactionary({
    inputSchema: CheckoutQueryForAvailableShippingMethodsSchema,
    outputSchema: z.array(ShippingMethodSchema),
  })
  public async getAvailableShippingMethods(
    payload: CheckoutQueryForAvailableShippingMethods
  ): Promise<ShippingMethod[]> {
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
      const shippingMethod = ShippingMethodSchema.parse({
        identifier: {
          key: sm.key,
        },
        name: sm.name,
        description:
          sm.localizedDescription?.[this.context.languageContext.locale] || '',
        price: sm.zoneRates[0].shippingRates[0].price
          ? {
              value:
                (sm.zoneRates[0].shippingRates[0].price.centAmount || 0) / 100,
              currency:
                sm.zoneRates[0].shippingRates[0].price.currencyCode ||
                this.context.languageContext.currencyCode,
            }
          : { value: 0, currency: this.context.languageContext.currencyCode },
      });
      result.push(shippingMethod);
    }
    return result;
  }

  @Reactionary({
    inputSchema: CheckoutQueryForAvailablePaymentMethodsSchema,
    outputSchema: z.array(PaymentMethodSchema),
  })
  public async getAvailablePaymentMethods(
    payload: CheckoutQueryForAvailablePaymentMethods
  ): Promise<PaymentMethod[]> {
    // Commercetools does not have a concept of payment methods, as these are handled by the payment providers.
    // So for now, we will return an empty array.
    const staticMethods = this.getStaticPaymentMethods(payload.checkout);

    const dynamicMethods: PaymentMethod[] = [];
    // later we will also fetch any stored payment methods the user has...

    return [...staticMethods, ...dynamicMethods];
  }

  @Reactionary({
    inputSchema: CheckoutMutationAddPaymentInstructionSchema,
    outputSchema: CheckoutSchema,
  })
  public async addPaymentInstruction(
    payload: CheckoutMutationAddPaymentInstruction
  ): Promise<T> {
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

    return this.applyActions(
      payload.checkout as CommercetoolsCheckoutIdentifier,
      actions
    );
  }

  @Reactionary({
    inputSchema: CheckoutMutationRemovePaymentInstructionSchema,
    outputSchema: CheckoutSchema,
  })
  public async removePaymentInstruction(
    payload: CheckoutMutationRemovePaymentInstruction
  ): Promise<T> {
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

    const checkout = await this.getById({ identifier: payload.checkout });
    return checkout!;
  }

  @Reactionary({
    inputSchema: CheckoutMutationSetShippingInstructionSchema,
    outputSchema: CheckoutSchema,
  })
  public async setShippingInstruction(
    payload: CheckoutMutationSetShippingInstruction
  ): Promise<T> {
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

    return this.applyActions(
      payload.checkout as CommercetoolsCheckoutIdentifier,
      actions
    );
  }

  @Reactionary({
    inputSchema: CheckoutMutationFinalizeCheckoutSchema,
    outputSchema: CheckoutSchema,
  })
  public async finalizeCheckout(
    payload: CheckoutMutationFinalizeCheckout
  ): Promise<T> {
    const checkout = await this.getById({ identifier: payload.checkout });
    if (!checkout || !checkout.readyForFinalization) {
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

    return this.getById({ identifier: payload.checkout }) as unknown as T;
  }

  protected async applyActions(
    checkout: CheckoutIdentifier,
    actions: MyCartUpdateAction[]
  ): Promise<T> {
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


  protected override parseSingle(remote: CTCart): T {
    const result = this.newModel();

    result.identifier = CommercetoolsCheckoutIdentifierSchema.parse({
      key: remote.id,
      version: remote.version || 0,
    });

    result.name = remote.custom?.fields['name'] || '';
    result.description = remote.custom?.fields['description'] || '';

    result.originalCartReference = CommercetoolsCartIdentifierSchema.parse({
      key: remote.custom?.fields['commerceToolsCartId'] || '',
      version: 0,
    });

    if (remote.shippingAddress) {
      result.shippingAddress = this.parseAddress(remote.shippingAddress);
    }

    if (remote.billingAddress) {
      result.billingAddress = this.parseAddress(remote.billingAddress);
    }
    result.shippingInstruction = this.parseShippingInstruction(remote);

    for (const p of remote.paymentInfo?.payments || []) {
      if (p.obj) {
        result.paymentInstructions.push(this.parsePaymentInstruction(p.obj));
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

    result.price = {
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
        currency: remote.shippingInfo?.price.currencyCode as Currency,
      },
      totalProductPrice: {
        value: productTotal / 100,
        currency,
      },
      grandTotal: {
        value: grandTotal / 100,
        currency,
      },
    };

    for (const remoteItem of remote.lineItems) {
      const item = CheckoutItemSchema.parse({});

      item.identifier.key = remoteItem.id;
      item.variant.sku = remoteItem.variant.sku || '';
      item.quantity = remoteItem.quantity;

      const unitPrice = remoteItem.price.value.centAmount;
      const totalPrice = remoteItem.totalPrice.centAmount || 0;
      const totalDiscount = remoteItem.price.discounted?.value.centAmount || 0;
      const unitDiscount = totalDiscount / remoteItem.quantity;

      item.price = {
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
      };

      result.items.push(item);
    }

    result.readyForFinalization = this.isReadyForFinalization(result);
    result.meta = {
      cache: {
        hit: false,
        key: this.generateCacheKeySingle(result.identifier),
      },
      placeholder: false,
    };

    return this.assert(result);
  }

  protected isReadyForFinalization(checkout: T): boolean {
    // we should have a billing address
    if (!checkout.billingAddress) return false;

    // we should know how to ship it
    if (!checkout.shippingInstruction) return false;

    // and it should ship either to an address or a pickup point
    if (!checkout.shippingAddress && !checkout.shippingInstruction.pickupPoint)
      return false;

    // and it should be paid for
    if (checkout.paymentInstructions.length === 0) return false;

    const authorizedPayments = checkout.paymentInstructions
      .filter((pi) => pi.status === 'authorized')
      .map((x) => x.amount.value)
      .reduce((a, b) => a + b, 0);
    if (checkout.price.grandTotal.value !== authorizedPayments) return false;

    return true;
  }

  protected parsePaymentInstruction(remote: CTPayment): PaymentInstruction {
    const newModel = PaymentInstructionSchema.parse({});
    newModel.identifier = PaymentInstructionIdentifierSchema.parse({
      key: remote.id || '',
    });
    newModel.amount = {
      value: remote.amountPlanned.centAmount / 100,
      currency: remote.amountPlanned.currencyCode as Currency,
    };

    const method = remote.paymentMethodInfo?.method || 'unknown';
    const paymentProcessor =
      remote.paymentMethodInfo?.paymentInterface || method;
    const paymentName =
      remote.paymentMethodInfo.name![this.context.languageContext.locale];
    newModel.paymentMethod = PaymentMethodIdentifierSchema.parse({
      method,
      paymentProcessor,
      name: paymentName || method || 'Unknown',
    });

    const customData = remote.custom?.fields || {};
    newModel.protocolData =
      Object.keys(customData).map((x) => ({ key: x, value: customData[x] })) ||
      [];
    if (remote.transactions && remote.transactions.length > 0) {
      const lastTransaction =
        remote.transactions[remote.transactions.length - 1];
      if (
        lastTransaction.type === 'Authorization' &&
        lastTransaction.state === 'Pending'
      ) {
        newModel.status = 'pending';
      } else if (
        lastTransaction.type === 'Authorization' &&
        lastTransaction.state === 'Success'
      ) {
        newModel.status = 'authorized';
      }
    } else {
      newModel.status = 'pending';
    }

    return PaymentInstructionSchema.parse(newModel);
  }

  protected parseAddress(remote: CTAddress) {
    return AddressSchema.parse({
      countryCode: remote.country || '',
      firstName: remote.firstName || '',
      lastName: remote.lastName || '',
      streetAddress: remote.streetName || '',
      streetNumber: remote.streetNumber || '',
      postalCode: remote.postalCode || '',
      city: remote.city || '',
    });
  }

  protected parseShippingInstruction(
    remote: CTCart
  ): ShippingInstruction | undefined {
    if (!remote.shippingInfo) return undefined;

    const instructions = remote.custom?.fields['shippingInstruction'] || '';
    const consentForUnattendedDelivery =
      remote.custom?.fields['consentForUnattendedDelivery'] === 'true' || false;
    const pickupPoint = remote.custom?.fields['pickupPointId'] || '';

    const shippingInstruction = ShippingInstructionSchema.parse({
      amount: {
        value: (remote.shippingInfo.price.centAmount || 0) / 100,
        currency: remote.shippingInfo.price.currencyCode as Currency,
      },
      shippingMethod: {
        key: remote.shippingInfo.shippingMethod?.obj?.key || '',
      },
      pickupPoint: pickupPoint || '',
      instructions: instructions || '',
      consentForUnattendedDelivery: consentForUnattendedDelivery || false,
    });

    return shippingInstruction;
  }
}
