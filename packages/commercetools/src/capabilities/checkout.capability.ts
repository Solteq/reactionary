import type { MyCartUpdateAction } from '@commercetools/platform-sdk';
import type {
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
  NotFoundError,
  PaymentMethod,
  RequestContext,
  Result,
} from '@reactionary/core';
import {
  CheckoutMutationAddPaymentInstructionSchema,
  CheckoutMutationFinalizeCheckoutSchema,
  CheckoutMutationInitiateCheckoutSchema,
  CheckoutMutationRemovePaymentInstructionSchema,
  CheckoutMutationSetShippingAddressSchema,
  CheckoutMutationSetShippingInstructionSchema,
  CheckoutCapability,
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
import * as z from 'zod';
import type { CommercetoolsAPI } from '../core/client.js';
import { type CommercetoolsCheckoutIdentifier } from '../schema/commercetools.schema.js';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type { CommercetoolsCheckoutFactory } from '../factories/checkout/checkout.factory.js';

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

export class CommercetoolsCheckoutCapability<
  TFactory extends CheckoutFactory = CommercetoolsCheckoutFactory,
> extends CheckoutCapability<
  CheckoutFactoryCheckoutOutput<TFactory>,
  CheckoutFactoryShippingMethodOutput<TFactory>,
  CheckoutFactoryPaymentMethodOutput<TFactory>
> {
  protected config: CommercetoolsConfiguration;
  protected commercetools: CommercetoolsAPI;
  protected factory: CheckoutFactoryWithOutput<TFactory>;

  constructor(
    config: CommercetoolsConfiguration,
    cache: Cache,
    context: RequestContext,
    commercetools: CommercetoolsAPI,
    factory: CheckoutFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);

    this.config = config;
    this.commercetools = commercetools;
    this.factory = factory;
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
  ): Promise<Result<CheckoutFactoryCheckoutOutput<TFactory>>> {
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

    return success(this.factory.parseCheckout(this.context, checkoutResponse.body));
  }

  @Reactionary({
    inputSchema: CheckoutQueryByIdSchema,
    outputSchema: CheckoutSchema.nullable(),
  })
  public async getById(payload: CheckoutQueryById): Promise<Result<CheckoutFactoryCheckoutOutput<TFactory>, NotFoundError>> {
    const client = await this.getClient();
    const checkoutResponse = await client.carts
      .withId({ ID: payload.identifier.key })
      .get({
        queryArgs: {
          expand: ['paymentInfo.payments[*]', 'shippingInfo.shippingMethod'],
        },
      })
      .execute();

    const checkout = this.factory.parseCheckout(this.context, checkoutResponse.body);

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
  ): Promise<Result<CheckoutFactoryCheckoutOutput<TFactory>>> {
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

    return success(this.factory.parseCheckout(this.context, checkoutResponse.body));
  }

  @Reactionary({
    inputSchema: CheckoutQueryForAvailableShippingMethodsSchema,
    outputSchema: z.array(ShippingMethodSchema),
  })
  public async getAvailableShippingMethods(
    payload: CheckoutQueryForAvailableShippingMethods
  ): Promise<Result<CheckoutFactoryShippingMethodOutput<TFactory>[]>> {
    const client = await this.getClient();
    const shippingMethodsResponse = await client.shippingMethods
      .matchingCart()
      .get({
        queryArgs: {
          cartId: payload.checkout.key,
        },
      })
      .execute();

    const result = shippingMethodsResponse.body.results.map((shippingMethod) =>
      this.factory.parseShippingMethod(this.context, shippingMethod),
    );

    return success(result);
  }

  @Reactionary({
    inputSchema: CheckoutQueryForAvailablePaymentMethodsSchema,
    outputSchema: z.array(PaymentMethodSchema),
  })
  public async getAvailablePaymentMethods(
    payload: CheckoutQueryForAvailablePaymentMethods
  ): Promise<Result<CheckoutFactoryPaymentMethodOutput<TFactory>[]>> {
    // Commercetools does not have a concept of payment methods, as these are handled by the payment providers.
    // So for now, we will return an empty array.
    const staticMethods = this.getStaticPaymentMethods(payload.checkout);

    const dynamicMethods: PaymentMethod[] = [];
    // later we will also fetch any stored payment methods the user has...

    const result = [...staticMethods, ...dynamicMethods].map((paymentMethod) =>
      this.factory.parsePaymentMethod(this.context, paymentMethod),
    );

    return success(result);
  }

  @Reactionary({
    inputSchema: CheckoutMutationAddPaymentInstructionSchema,
    outputSchema: CheckoutSchema,
  })
  public async addPaymentInstruction(
    payload: CheckoutMutationAddPaymentInstruction
  ): Promise<Result<CheckoutFactoryCheckoutOutput<TFactory>>> {
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
  ): Promise<Result<CheckoutFactoryCheckoutOutput<TFactory>>> {
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
  ): Promise<Result<CheckoutFactoryCheckoutOutput<TFactory>>> {
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
  ): Promise<Result<CheckoutFactoryCheckoutOutput<TFactory>>> {
    const checkout = await this.getById({ identifier: payload.checkout });
    if (!checkout.success || !checkout.value.readyForFinalization) {
      throw new CheckoutNotReadyForFinalizationError(payload.checkout);
    }

    const client = await this.getClient();
    const ctId = payload.checkout as CommercetoolsCheckoutIdentifier;

    // create the order from the cart
    await client.orders
      .post({
        body: {
          id: ctId.key,
          version: ctId.version,
        },
      })
      .execute();

    const result = await this.getById({
      identifier: payload.checkout,
    });

    if (!result.success) {
      throw new Error('Unable to fetch checkout after finalization.');
    }

    return success(result.value);
  }

  protected async applyActions(
    checkout: CheckoutIdentifier,
    actions: MyCartUpdateAction[]
  ): Promise<CheckoutFactoryCheckoutOutput<TFactory>> {
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

      const p = this.factory.parseCheckout(this.context, response.body);

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
}
