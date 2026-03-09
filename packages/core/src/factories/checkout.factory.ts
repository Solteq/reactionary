import type * as z from 'zod';
import type { CheckoutSchema } from '../schemas/models/checkout.model.js';
import type { PaymentMethodSchema } from '../schemas/models/payment.model.js';
import type { ShippingMethodSchema } from '../schemas/models/shipping-method.model.js';
import type { RequestContext } from '../schemas/session.schema.js';

export type AnyCheckoutSchema = z.ZodType<z.output<typeof CheckoutSchema>>;
export type AnyShippingMethodSchema = z.ZodType<
  z.output<typeof ShippingMethodSchema>
>;
export type AnyPaymentMethodSchema = z.ZodType<
  z.output<typeof PaymentMethodSchema>
>;

export interface CheckoutFactory<
  TCheckoutSchema extends AnyCheckoutSchema = AnyCheckoutSchema,
  TShippingMethodSchema extends AnyShippingMethodSchema = AnyShippingMethodSchema,
  TPaymentMethodSchema extends AnyPaymentMethodSchema = AnyPaymentMethodSchema,
> {
  checkoutSchema: TCheckoutSchema;
  shippingMethodSchema: TShippingMethodSchema;
  paymentMethodSchema: TPaymentMethodSchema;
  parseCheckout(context: RequestContext, data: unknown): z.output<TCheckoutSchema>;
  parseShippingMethod(
    context: RequestContext,
    data: unknown,
  ): z.output<TShippingMethodSchema>;
  parsePaymentMethod(
    context: RequestContext,
    data: unknown,
  ): z.output<TPaymentMethodSchema>;
}

export type CheckoutFactoryCheckoutOutput<TFactory extends CheckoutFactory> =
  ReturnType<TFactory['parseCheckout']>;
export type CheckoutFactoryShippingMethodOutput<
  TFactory extends CheckoutFactory,
> = ReturnType<TFactory['parseShippingMethod']>;
export type CheckoutFactoryPaymentMethodOutput<
  TFactory extends CheckoutFactory,
> = ReturnType<TFactory['parsePaymentMethod']>;

export type CheckoutFactoryWithOutput<TFactory extends CheckoutFactory> = Omit<
  TFactory,
  'parseCheckout' | 'parseShippingMethod' | 'parsePaymentMethod'
> & {
  parseCheckout(
    context: RequestContext,
    data: unknown,
  ): CheckoutFactoryCheckoutOutput<TFactory>;
  parseShippingMethod(
    context: RequestContext,
    data: unknown,
  ): CheckoutFactoryShippingMethodOutput<TFactory>;
  parsePaymentMethod(
    context: RequestContext,
    data: unknown,
  ): CheckoutFactoryPaymentMethodOutput<TFactory>;
};
