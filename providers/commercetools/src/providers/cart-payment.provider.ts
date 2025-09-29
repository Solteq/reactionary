
import type { CommercetoolsConfiguration } from "../schema/configuration.schema";
import { CommercetoolsClient } from "../core/client";
import type { Payment as CTPayment} from "@commercetools/platform-sdk";
import { PaymentStatus } from "@commercetools/platform-sdk";
import { traced } from "@reactionary/otel";
import type { CommercetoolsCartIdentifier} from "../schema/commercetools.schema";
import { CommercetoolsCartIdentifierSchema, CommercetoolsCartPaymentInstructionIdentifierSchema } from "../schema/commercetools.schema";
import {  CartPaymentProvider, PaymentMethodIdentifierSchema,  } from "@reactionary/core";
import type { CartPaymentQueryByCart, CartPaymentMutationAddPayment, CartPaymentMutationCancelPayment, Session, RequestContext , Cache, CartPaymentInstruction, Currency} from "@reactionary/core";
import type z from "zod";

export class CommercetoolsCartPaymentProvider<
  T extends CartPaymentInstruction = CartPaymentInstruction
> extends CartPaymentProvider<T> {
  protected config: CommercetoolsConfiguration;

  constructor(config: CommercetoolsConfiguration, schema: z.ZodType<T>, cache: Cache) {
    super(schema, cache);

    this.config = config;
  }

  protected async getClient(reqCtx: RequestContext) {
    const client = await new CommercetoolsClient(this.config).getClient(reqCtx);

    return {
      payments: client.withProjectKey({ projectKey: this.config.projectKey }).me().payments(),
      carts: client.withProjectKey({ projectKey: this.config.projectKey }).me().carts()
    };
  }



  @traced()
  public override async getByCartIdentifier(payload: CartPaymentQueryByCart, reqCtx: RequestContext): Promise<T[]> {
    const client = await this.getClient(reqCtx);

    const ctId = payload.cart as CommercetoolsCartIdentifier;
    const ctVersion = ctId.version || 0;

    const cart = await client.carts.withId({ ID: ctId.key })
        .get({
            queryArgs: {
              expand: 'paymentInfo.payments[*]',
            },
          })
          .execute();

      let payments = (cart.body.paymentInfo?.payments || []).map(x => x.obj!).filter(x => x);
      if (payload.status) {
        payments = payments.filter(payment => payload.status!.some(status => payment.paymentStatus?.interfaceCode === status));
      }

      // Map over the payments and parse each one
      const parsedPayments = payments.map(payment => this.parseSingle(payment, reqCtx));

      // Commercetools does not link carts to payments, but the other way around, so for this we have to synthesize the link.
      const returnPayments = parsedPayments.map(x => {
        x.cart = { key: cart.body.id, version: cart.body.version || 0 };
        return x;
      });
      return returnPayments;
  }



  public override async initiatePaymentForCart(payload: CartPaymentMutationAddPayment, reqCtx: RequestContext): Promise<T> {
    const client = await this.getClient(reqCtx);
    const cartId = payload.cart as CommercetoolsCartIdentifier;
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
        custom:{
          type: {
            typeId: 'type',
            key: 'reactionaryPaymentCustomFields',
          },
          fields: {
            cartId: cartId.key,
            cartVersion: cartId.version + '',
          }
        },

      },
    }).execute();

    // Now add the payment to the cart
    const ctId = payload.cart as CommercetoolsCartIdentifier
    const updatedCart = await client.carts.withId({ ID: ctId.key }).post({
      body: {
        version: ctId.version,
        actions: [
          {
            'action': 'addPayment',
            'payment': {
              'typeId': 'payment',
              'id': response.body.id
            }
          }
        ]
      }
    }).execute();

    const payment = this.parseSingle(response.body, reqCtx);

    // we return the newest cart version so caller can update their cart reference, if they want to.
    // hopefully this wont cause excessive confusion
    payment.cart = CommercetoolsCartIdentifierSchema.parse({
        key: updatedCart.body.id,
        version: updatedCart.body.version || 0
      });
    return payment;
  }


  @traced()
  public override async cancelPaymentInstruction(payload: CartPaymentMutationCancelPayment, reqCtx: RequestContext): Promise<T> {
    const client = await this.getClient(reqCtx);

    // get newest version
    const newestVersion = await client.payments.withId({ ID: payload.paymentInstruction.key }).get().execute();


    // we set the planned amount to 0, which effectively cancels the payment, and also allows the backend to clean it up.
    // Note: This does NOT remove the payment from the cart, as that would be a breaking change to the cart, and we want to avoid that during checkout.
    // Instead, the payment will remain on the cart, but with status 'canceled', and can be removed later if needed.
    // This also allows us to keep a record of the payment instruction for auditing purposes.
    // The cart can be re-used, and a new payment instruction can be added to it later.
    // The frontend should ignore any payment instructions with status 'canceled' when displaying payment options to the user.
    const response = await client.payments.withId({ ID: payload.paymentInstruction.key }).post({
      body: {
        version: newestVersion.body.version,
        actions: [
          {
            action: 'changeAmountPlanned',
            amount: {
              centAmount: 0,
              currencyCode: newestVersion.body.amountPlanned.currencyCode
            }
          },
        ]
      }
    }).execute();

    const payment = this.parseSingle(response.body, reqCtx);
    payment.cart = payload.cart;
    return payment;
  }



  @traced()
  protected override parseSingle(_body: unknown, reqCtx: RequestContext): T {
    const body = _body as CTPayment;

    const base = this.newModel();
    base.identifier = CommercetoolsCartPaymentInstructionIdentifierSchema.parse({
      key: body.id,
      version: body.version || 0
    });

    base.amount = {
      value: body.amountPlanned.centAmount / 100,
      currency: body.amountPlanned.currencyCode as Currency,
    };


    base.paymentMethod = PaymentMethodIdentifierSchema.parse({
      key: body.paymentMethodInfo?.method
    });

    // FIXME: seems wrong
    base.status = body.paymentStatus?.interfaceCode as unknown as any;

    base.cart = { key: '', version: 0 };

    return this.assert(base);
  }


}
