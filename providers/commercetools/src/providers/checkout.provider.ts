
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
  PaymentInstruction
} from "@reactionary/core";
import { AddressSchema, CheckoutItemSchema, CheckoutProvider, PaymentInstructionIdentifierSchema, PaymentInstructionSchema, PaymentMethodIdentifierSchema, ShippingInstructionSchema, ShippingMethodSchema } from "@reactionary/core";
import type z from "zod";
import { CommercetoolsClient } from "../core/client.js";
import type { CommercetoolsConfiguration } from "../schema/configuration.schema.js";
import type { MyCartUpdateAction } from "@commercetools/platform-sdk";
import { CommercetoolsCartIdentifierSchema, CommercetoolsCheckoutIdentifierSchema, CommercetoolsOrderIdentifierSchema, type CommercetoolsCheckoutIdentifier } from "../schema/commercetools.schema.js";
import type  { Address as CTAddress, Payment as CTPayment, Cart as CTCart, ShippingMethod as CTShippingMethod } from "@commercetools/platform-sdk";


export class CheckoutNotReadyForFinalizationError extends Error {
  constructor(public checkoutIdentifier: CheckoutIdentifier) {
    super("Checkout is not ready for finalization. Ensure all required fields are set and valid. " + (checkoutIdentifier ? `Checkout ID: ${JSON.stringify(checkoutIdentifier)}` : ''));
    this.name = "CheckoutNotReadyForFinalizationError";
  }
}


export class CommercetoolsCheckoutProvider<
  T extends Checkout = Checkout
> extends CheckoutProvider<T> {
  protected config: CommercetoolsConfiguration;

  constructor(config: CommercetoolsConfiguration, schema: z.ZodType<T>, cache: Cache) {
    super(schema, cache);

    this.config = config;
  }

  protected async getClient(reqCtx: RequestContext) {
    const client = await new CommercetoolsClient(this.config).getClient(reqCtx);

    return {
      payments: client.withProjectKey({ projectKey: this.config.projectKey }).me().payments(),
      carts: client.withProjectKey({ projectKey: this.config.projectKey }).me().carts(),
      shippingMethods: client.withProjectKey({ projectKey: this.config.projectKey }).shippingMethods(),
      orders: client.withProjectKey({ projectKey: this.config.projectKey }).me().orders()
    };
  }

  public async initiateCheckoutForCart(payload: CheckoutMutationInitiateCheckout, reqCtx: RequestContext): Promise<T> {
    // so......we could copy the cart......

    const client = await this.getClient(reqCtx);

    const cart = await client.carts.withId({ ID: (payload.cart as any).key }).get().execute();
    const replicationResponse = await client.carts.replicate().post({
      body: {
        reference: {
          typeId: 'cart',
          id: cart.body.id
        }
      }
    }).execute();
    // set the custom type to mark it as a checkout

    const actions: MyCartUpdateAction[] = [
        {
            action: 'setCustomType',
            type: {
              typeId: 'type',
              key: 'reactionaryCheckout'
            },
            fields: {
              commerceToolsCartId: payload.cart.key,
            }
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
              phone: payload.notificationPhone || ''
            }
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
            }
        });
    }

    const checkoutResponse = await client.carts.withId({ ID: replicationResponse.body.id }).post({
      body: {
        version: replicationResponse.body.version || 0,
        actions: [
          ...actions
        ]
      }
    }).execute();

    return this.parseSingle(checkoutResponse.body, reqCtx);

  }

  public async getById(payload: CheckoutQueryById, reqCtx: RequestContext): Promise<T | null> {

    const client = await this.getClient(reqCtx);
    const checkoutResponse = await client.carts.withId({ ID: payload.identifier.key }).get({
      queryArgs: {
        expand: ['paymentInfo.payments[*]', 'shippingInfo.shippingMethod']
      }
    }).execute();

    return this.parseSingle(checkoutResponse.body, reqCtx);
  }

  public async setShippingAddress(payload: CheckoutMutationSetShippingAddress, reqCtx: RequestContext): Promise<T> {
    const client = await this.getClient(reqCtx);

    const version = (payload.checkout as CommercetoolsCheckoutIdentifier).version;
    const checkoutResponse = await client.carts.withId({ ID: payload.checkout.key }).post({
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
            }
          }
        ]
      }
    }).execute();

    return this.parseSingle(checkoutResponse.body, reqCtx);
  }

  public async getAvailableShippingMethods(payload: CheckoutQueryForAvailableShippingMethods, reqCtx: RequestContext): Promise<ShippingMethod[]> {
    const client = await this.getClient(reqCtx);
    const shippingMethodsResponse = await client.shippingMethods.matchingCart().get({
      queryArgs: {
        cartId: payload.checkout.key
      }
    }).execute();

    const result: Array<ShippingMethod> = [];
    const inputShippingMethods: CTShippingMethod[] = shippingMethodsResponse.body.results as CTShippingMethod[];
    for (const sm of inputShippingMethods) {
      const shippingMethod = ShippingMethodSchema.parse({
        identifier: {
          key: sm.key,
        },
        name: sm.name,
        description: sm.localizedDescription?.[ reqCtx.languageContext.locale ] || '',
        price: sm.zoneRates[0].shippingRates[0].price ? {
          value: (sm.zoneRates[0].shippingRates[0].price.centAmount || 0) / 100,
          currency: sm.zoneRates[0].shippingRates[0].price.currencyCode || reqCtx.languageContext.currencyCode
        } : { value: 0, currency: reqCtx.languageContext.currencyCode },
      });
      result.push(shippingMethod);
    }
    return result;
  }

  public async getAvailablePaymentMethods(payload: CheckoutQueryForAvailablePaymentMethods, reqCtx: RequestContext): Promise<PaymentMethod[]> {
    // Commercetools does not have a concept of payment methods, as these are handled by the payment providers.
    // So for now, we will return an empty array.
    const staticMethods = this.getStaticPaymentMethods(payload.checkout, reqCtx);

    const dynamicMethods: PaymentMethod[] = [];
    // later we will also fetch any stored payment methods the user has...

    return [...staticMethods, ...dynamicMethods];
  }

  public async addPaymentInstruction(payload: CheckoutMutationAddPaymentInstruction, reqCtx: RequestContext): Promise<T> {
    const client = await this.getClient(reqCtx);

    const response = await client.payments.post({
      body: {

        amountPlanned: {
          centAmount: Math.round(payload.paymentInstruction.amount.value * 100),
          currencyCode: payload.paymentInstruction.amount.currency
        },
        paymentMethodInfo: {
          method: payload.paymentInstruction.paymentMethod.method,
          name: {
            [reqCtx.languageContext.locale]: payload.paymentInstruction.paymentMethod.name
          },
          paymentInterface: payload.paymentInstruction.paymentMethod.paymentProcessor
        },
        custom: {
          type: {
            typeId: 'type',
            key: 'reactionaryPaymentCustomFields',
          },
          fields: {
            'commerceToolsCartId': payload.checkout.key,
          }
        }
      },
    }).execute();

    const version = (payload.checkout as CommercetoolsCheckoutIdentifier).version;
    const actions: MyCartUpdateAction[] = [
      {
        action: 'addPayment',
        payment: {
          typeId: 'payment',
          id: response.body.id
        }
      }
    ];

    return this.applyActions(payload.checkout as CommercetoolsCheckoutIdentifier, actions, reqCtx);
  }

  public async removePaymentInstruction(payload: CheckoutMutationRemovePaymentInstruction, reqCtx: RequestContext): Promise<T> {
   const client = await this.getClient(reqCtx);


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

    const checkout =  await this.getById({ identifier: payload.checkout }, reqCtx);
    return checkout!

  }

  public async setShippingInstruction(payload: CheckoutMutationSetShippingInstruction, reqCtx: RequestContext): Promise<T> {

    const client = await this.getClient(reqCtx);
    const ctId = payload.checkout as CommercetoolsCheckoutIdentifier;

    const actions: MyCartUpdateAction[] = [];
      actions.push({
        action: 'setShippingMethod',
        shippingMethod: {
          typeId: 'shipping-method',
          key: payload.shippingInstruction.shippingMethod.key
        }
      });
      actions.push({
        action: 'setCustomField',
        name: 'shippingInstruction',
        value: payload.shippingInstruction.instructions
      });
      actions.push({
        action: 'setCustomField',
        name: 'consentForUnattendedDelivery',
        value: payload.shippingInstruction.consentForUnattendedDelivery + ''
      });
      actions.push({
        action: 'setCustomField',
        name: 'pickupPointId',
        value: payload.shippingInstruction.pickupPoint
      });



    return this.applyActions(payload.checkout as CommercetoolsCheckoutIdentifier, actions, reqCtx);
  }

  public async finalizeCheckout(payload: CheckoutMutationFinalizeCheckout, reqCtx: RequestContext): Promise<T> {
    const checkout = await this.getById({ identifier: payload.checkout }, reqCtx);
    if (!checkout || !checkout.readyForFinalization) {
      throw new CheckoutNotReadyForFinalizationError(payload.checkout);
    }

    const client = await this.getClient(reqCtx);
    const ctId = payload.checkout as CommercetoolsCheckoutIdentifier;

    // create the order from the cart
    const orderResponse = await client.orders.post({
      body: {
        id: ctId.key,
        version: ctId.version
      }
    }).execute();

    const actions: MyCartUpdateAction[] = [];
      actions.push({
        action: 'setCustomField',
        name: 'commerceToolsOrderId',
        value: orderResponse.body.id
    });

    return this.applyActions(payload.checkout as CommercetoolsCheckoutIdentifier, actions, reqCtx);
  }




  protected async applyActions(
    checkout: CheckoutIdentifier,
    actions: MyCartUpdateAction[],
    reqCtx: RequestContext
  ): Promise<T> {
    const client = await this.getClient(reqCtx);
    const ctId = checkout as CommercetoolsCheckoutIdentifier;


       try {
        const response = await client.carts
          .withId({ ID: ctId.key })
          .post({
            queryArgs: {
              expand: ['paymentInfo.payments[*]', 'shippingInfo.shippingMethod']
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
          return this.parseSingle(response.body, reqCtx);
       } catch (e: any) {
        console.error('Error applying actions to cart:', e);
        throw e;
       }

  }

  /**
   * Extension point, to allow filtering the options, or adding new ones, like invoicing for b2b.
   *
   * Usecase: Override this, if you need to change the payment options based on the request context.
   * @param reqCtx
   * @returns
   */
  protected getStaticPaymentMethods(_checkout: CheckoutIdentifier, reqCtx: RequestContext): PaymentMethod[] {
    return this.config.paymentMethods || [];
  }



  protected override getResourceName(): string {
    return "checkout";
  }


  protected override parseSingle(remote: CTCart, reqCtx: RequestContext): T {
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

      const orderId = remote.custom?.fields['commerceToolsOrderId'];
      if (orderId) {
        result.resultingOrder = CommercetoolsOrderIdentifierSchema.parse({
          key: orderId,
          version: 0,
        });
      }


      if (remote.shippingAddress) {
        result.shippingAddress = this.parseAddress( remote.shippingAddress, reqCtx) ;
      }

      if (remote.billingAddress ) {
        result.billingAddress = this.parseAddress( remote.billingAddress, reqCtx) ;
      }
      result.shippingInstruction = this.parseShippingInstruction(remote);

      for(const p of remote.paymentInfo?.payments || []) {
        if (p.obj) {
          result.paymentInstructions.push( this.parsePaymentInstruction(p.obj, reqCtx) );
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
        item.sku.key = remoteItem.variant.sku || '';
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
          key: this.generateCacheKeySingle(result.identifier, reqCtx),
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
      if (!checkout.shippingAddress && !checkout.shippingInstruction.pickupPoint) return false;

      // and it should be paid for
      if (checkout.paymentInstructions.length === 0) return false;

      const authorizedPayments = checkout.paymentInstructions.filter(pi => pi.status === 'authorized').map(x => x.amount.value).reduce((a, b) => a + b, 0);
      if (checkout.price.grandTotal.value !== authorizedPayments) return false;

      return true
    }

    protected parsePaymentInstruction(remote: CTPayment, reqCtx: RequestContext): PaymentInstruction {
      const newModel = PaymentInstructionSchema.parse({});
      newModel.identifier = PaymentInstructionIdentifierSchema.parse({ key: remote.id || '' });
      newModel.amount = {
        value: remote.amountPlanned.centAmount / 100,
        currency: remote.amountPlanned.currencyCode as Currency,
      };



      const method = remote.paymentMethodInfo?.method || 'unknown';
      const paymentProcessor = remote.paymentMethodInfo?.paymentInterface || method;
      const paymentName = remote.paymentMethodInfo.name![reqCtx.languageContext.locale];
      newModel.paymentMethod = PaymentMethodIdentifierSchema.parse({
        method,
        paymentProcessor,
        name: paymentName || method || 'Unknown',
      });

      const customData = remote.custom?.fields || {};
      newModel.protocolData = Object.keys(customData).map(x => ({ key: x, value: customData[x] })) || [];
      if (remote.transactions && remote.transactions.length > 0) {
        const lastTransaction = remote.transactions[remote.transactions.length - 1];
        if (lastTransaction.type === 'Authorization' && lastTransaction.state === 'Pending') {
          newModel.status = 'pending';
        } else if (lastTransaction.type === 'Authorization' && lastTransaction.state === 'Success') {
          newModel.status = 'authorized';
        }
      } else {
        newModel.status = 'pending';
      }

      return PaymentInstructionSchema.parse(newModel);
    }

    protected parseAddress(remote: CTAddress, reqCtx: RequestContext) {
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

    protected parseShippingInstruction(remote: CTCart): ShippingInstruction | undefined {
      if (!remote.shippingInfo) return undefined;

      const instructions = remote.custom?.fields['shippingInstruction'] || '';
      const consentForUnattendedDelivery = remote.custom?.fields['consentForUnattendedDelivery'] === 'true' || false;
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
