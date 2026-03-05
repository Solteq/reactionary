import type {
  AnyCheckoutSchema,
  AnyPaymentMethodSchema,
  AnyShippingMethodSchema,
  CheckoutFactory,
  CheckoutSchema,
  PaymentMethodSchema,
  RequestContext,
  ShippingMethodSchema,
} from '@reactionary/core';
import type * as z from 'zod';

export class FakeCheckoutFactory<
  TCheckoutSchema extends AnyCheckoutSchema = typeof CheckoutSchema,
  TShippingMethodSchema extends AnyShippingMethodSchema = typeof ShippingMethodSchema,
  TPaymentMethodSchema extends AnyPaymentMethodSchema = typeof PaymentMethodSchema,
> implements CheckoutFactory<TCheckoutSchema, TShippingMethodSchema, TPaymentMethodSchema>
{
  public readonly checkoutSchema: TCheckoutSchema;
  public readonly shippingMethodSchema: TShippingMethodSchema;
  public readonly paymentMethodSchema: TPaymentMethodSchema;

  constructor(
    checkoutSchema: TCheckoutSchema,
    shippingMethodSchema: TShippingMethodSchema,
    paymentMethodSchema: TPaymentMethodSchema,
  ) {
    this.checkoutSchema = checkoutSchema;
    this.shippingMethodSchema = shippingMethodSchema;
    this.paymentMethodSchema = paymentMethodSchema;
  }

  public parseCheckout(
    _context: RequestContext,
    data: unknown,
  ): z.output<TCheckoutSchema> {
    return this.checkoutSchema.parse(data);
  }

  public parseShippingMethod(
    _context: RequestContext,
    data: unknown,
  ): z.output<TShippingMethodSchema> {
    return this.shippingMethodSchema.parse(data);
  }

  public parsePaymentMethod(
    _context: RequestContext,
    data: unknown,
  ): z.output<TPaymentMethodSchema> {
    return this.paymentMethodSchema.parse(data);
  }
}
