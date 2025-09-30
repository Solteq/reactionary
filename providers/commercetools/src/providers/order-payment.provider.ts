
import type { CommercetoolsConfiguration } from "../schema/configuration.schema";
import { CommercetoolsClient } from "../core/client";
import type { Payment as CTPayment } from "@commercetools/platform-sdk";
import { traced } from "@reactionary/otel";
import type { CommercetoolsOrderIdentifier } from "../schema/commercetools.schema";
import { CommercetoolsCartPaymentInstructionIdentifierSchema } from "../schema/commercetools.schema";
import { OrderPaymentProvider, PaymentMethodIdentifierSchema } from "@reactionary/core";
import type { RequestContext, Cache, Currency, OrderPaymentInstruction, OrderPaymentQueryByOrder } from "@reactionary/core";
import type z from "zod";

export class CommercetoolsOrderPaymentProvider<
  T extends OrderPaymentInstruction = OrderPaymentInstruction
> extends OrderPaymentProvider<T> {
  protected config: CommercetoolsConfiguration;

  constructor(config: CommercetoolsConfiguration, schema: z.ZodType<T>, cache: Cache) {
    super(schema, cache);

    this.config = config;
  }

  protected async getClient(reqCtx: RequestContext) {
    const client = await new CommercetoolsClient(this.config).getClient(reqCtx);

    return {
      payments: client.withProjectKey({ projectKey: this.config.projectKey }).me().payments(),
      orders: client.withProjectKey({ projectKey: this.config.projectKey }).me().orders()
    };
  }



  @traced()
  public override async getByOrderIdentifier(payload: OrderPaymentQueryByOrder, reqCtx: RequestContext): Promise<T[]> {
    const client = await this.getClient(reqCtx);

    const ctId = payload.order as CommercetoolsOrderIdentifier;
    const ctVersion = ctId.version || 0;

    const order = await client.orders.withId({ ID: ctId.key })
        .get({
            queryArgs: {
              expand: 'paymentInfo.payments[*]',
            },
          })
          .execute();

      let payments = (order.body.paymentInfo?.payments || []).map(x => x.obj!).filter(x => x);
      if (payload.status) {
        payments = payments.filter(payment => payload.status!.some(status => payment.paymentStatus?.interfaceCode === status));
      }

      // Map over the payments and parse each one
      const parsedPayments = payments.map(payment => this.parseSingle(payment, reqCtx));

      // Commercetools does not link carts to payments, but the other way around, so for this we have to synthesize the link.
      const returnPayments = parsedPayments.map(x => {
        x.order = { key: order.body.id, version: order.body.version || 0 };
        return x;
      });
      return returnPayments;
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

    const customData = body.custom?.fields || {};
    base.protocolData = Object.keys(customData).map(x => ({ key: x, value: customData[x] })) || [];

    // FIXME: seems wrong
    base.status = body.paymentStatus?.interfaceCode as unknown as any;
    base.order = { key: '', version: 0 };
    return this.assert(base);
  }


}
