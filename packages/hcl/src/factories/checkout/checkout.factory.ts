import type * as z from 'zod';
import {
  CheckoutSchema,
  ShippingMethodSchema,
  PaymentMethodSchema,
  type AnyCheckoutSchema,
  type AnyShippingMethodSchema,
  type AnyPaymentMethodSchema,
  type CheckoutFactory,
  type RequestContext,
} from '@reactionary/core';
import type {
  HclWcsCartResponse,
  HclWcsShipMode,
  HclWcsPaymentMethod,
} from '../../schema/hcl.schema.js';

export class HclCheckoutFactory<
  TCheckoutSchema extends AnyCheckoutSchema = typeof CheckoutSchema,
  TShippingMethodSchema extends
    AnyShippingMethodSchema = typeof ShippingMethodSchema,
  TPaymentMethodSchema extends
    AnyPaymentMethodSchema = typeof PaymentMethodSchema,
> implements
    CheckoutFactory<
      TCheckoutSchema,
      TShippingMethodSchema,
      TPaymentMethodSchema
    >
{
  constructor(
    public readonly checkoutSchema: TCheckoutSchema,
    public readonly shippingMethodSchema: TShippingMethodSchema = ShippingMethodSchema as unknown as TShippingMethodSchema,
    public readonly paymentMethodSchema: TPaymentMethodSchema = PaymentMethodSchema as unknown as TPaymentMethodSchema,
  ) {}

  parseCheckout(
    context: RequestContext,
    data: unknown,
  ): z.output<TCheckoutSchema> {
    const cart = data as HclWcsCartResponse & {
      resultingOrderKey?: string;
    };
    const currency =
      cart.totalProductPriceCurrency ?? cart.grandTotalCurrency ?? 'USD';

    // WCS returns shipModeId at cart level in some versions and in orderItem in others.
    const shipModeId =
      cart.shipModeId ?? (cart.orderItem ?? [])[0]?.shipModeId;

    const shippingInstruction = shipModeId
      ? {
          shippingMethod: { key: shipModeId },
          pickupPoint: '',
          instructions: '',
          consentForUnattendedDelivery: false,
        }
      : undefined;

    const billingEmail =
      cart.x_billingAddress?.email1 ??
      (cart.paymentInstruction ?? [])
        .flatMap((pi) => pi.protocolData ?? [])
        .find((pd) => pd.name === 'email1')?.value ??
      (context.session['hcl.notificationEmail'] as string | undefined) ??
      'noreply@checkout.example.com';

    const paymentInstructions = (cart.paymentInstruction ?? []).map((pi) => ({
      identifier: { key: pi.piId },
      paymentMethod: {
        method: pi.payMethodId,
        name: pi.payMethodId,
        paymentProcessor: pi.payMethodId,
      },
      amount: {
        value: Number(pi.piAmount ?? '0'),
        currency: pi.currency ?? currency,
      },
      protocolData: (pi.protocolData ?? []).map((pd) => ({
        key: pd.name,
        value: pd.value,
      })),
      status: 'pending' as const,
    }));

    const parseAddress = (addr: HclWcsCartResponse['x_shippingAddress']) => {
      if (!addr) return undefined;
      return {
        identifier: { key: addr.addressId ?? '' },
        firstName: addr.firstName ?? '',
        lastName: addr.lastName ?? '',
        streetAddress: (addr.addressLine ?? [])[0] ?? '',
        streetNumber: '',
        city: addr.city ?? '',
        region: addr.state ?? '',
        postalCode: addr.zipCode ?? '',
        countryCode: addr.country ?? '',
      };
    };

    return this.checkoutSchema.parse({
      identifier: { key: cart.orderId },
      originalCartReference: { key: cart.orderId },
      resultingOrder: cart.resultingOrderKey
        ? { key: cart.resultingOrderKey }
        : undefined,
      items: (cart.orderItem ?? []).map((item) => ({
        identifier: { key: item.orderItemId },
        variant: { sku: item.partNumber },
        quantity: Number(item.quantity),
        price: {
          unitPrice: {
            value: Number(item.unitPrice),
            currency: item.currency,
          },
          totalPrice: {
            value: Number(item.orderItemPrice),
            currency: item.currency,
          },
          unitDiscount: { value: 0, currency: item.currency },
          totalDiscount: { value: 0, currency: item.currency },
        },
      })),
      price: {
        grandTotal: { value: Number(cart.grandTotal ?? '0'), currency },
        totalProductPrice: {
          value: Number(cart.totalProductPrice ?? '0'),
          currency,
        },
        totalShipping: {
          value: Number(cart.totalShippingCharge ?? '0'),
          currency,
        },
        totalTax: { value: Number(cart.totalSalesTax ?? '0'), currency },
        totalDiscount: {
          value: Math.abs(Number(cart.totalAdjustment ?? '0')),
          currency,
        },
        totalSurcharge: { value: 0, currency },
      },
      name: (context.session['hcl.cartName'] as string | undefined) ?? '',
      description: '',
      shippingAddress: parseAddress(cart.x_shippingAddress),
      billingAddress: parseAddress(cart.x_billingAddress),
      shippingInstruction,
      paymentInstructions,
      pointOfContact: {
        email: billingEmail,
        phone: cart.x_billingAddress?.phone1,
      },
      readyForFinalization: paymentInstructions.length > 0 && !!cart.shipModeId,
    }) as z.output<TCheckoutSchema>;
  }

  parseShippingMethod(
    _context: RequestContext,
    data: unknown,
  ): z.output<TShippingMethodSchema> {
    const mode = data as HclWcsShipMode;
    return this.shippingMethodSchema.parse({
      identifier: { key: mode.shipModeId },
      name: mode.shipModeDescription || mode.shipModeCode,
      description: mode.shipModeDescription || mode.shipModeCode,
      price: { value: 0, currency: 'USD' },
      deliveryTime: mode.field2 ?? '',
      carrier: mode.carrier,
    }) as z.output<TShippingMethodSchema>;
  }

  parsePaymentMethod(
    _context: RequestContext,
    data: unknown,
  ): z.output<TPaymentMethodSchema> {
    const method = data as HclWcsPaymentMethod;
    return this.paymentMethodSchema.parse({
      identifier: {
        method: method.paymentMethodName,
        name: method.description ?? method.paymentMethodName,
        paymentProcessor: method.paymentMethodName,
      },
      description: method.description ?? method.paymentMethodName,
      isPunchOut: false,
    }) as z.output<TPaymentMethodSchema>;
  }
}
