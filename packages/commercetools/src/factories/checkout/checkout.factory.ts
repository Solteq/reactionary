import type {
  Address as CTAddress,
  Cart as CTCart,
  LineItem,
  Payment as CTPayment,
  ShippingMethod as CTShippingMethod,
} from '@commercetools/platform-sdk';
import type {
  CheckoutSchema,
  PaymentMethodSchema,
  ShippingMethodSchema} from '@reactionary/core';
import {
  CheckoutItemSchema,
  type Address,
  type AnyCheckoutSchema,
  type AnyPaymentMethodSchema,
  type AnyShippingMethodSchema,
  type Checkout,
  type CheckoutFactory,
  type CheckoutIdentifier,
  type CheckoutItem,
  type CostBreakDown,
  type Currency,
  type MonetaryAmount,
  type PaymentInstruction,
  type PaymentInstructionIdentifier,
  type PaymentMethod,
  type PaymentMethodIdentifier,
  type PaymentStatus,
  type RequestContext,
  type ShippingInstruction,
  type ShippingMethod,
  type ShippingMethodIdentifier,
} from '@reactionary/core';
import type * as z from 'zod';
import type {
  CommercetoolsCartIdentifier,
  CommercetoolsCheckoutIdentifier,
} from '../../schema/commercetools.schema.js';

export class CommercetoolsCheckoutFactory<
  TCheckoutSchema extends AnyCheckoutSchema = typeof CheckoutSchema,
  TShippingMethodSchema extends AnyShippingMethodSchema = typeof ShippingMethodSchema,
  TPaymentMethodSchema extends AnyPaymentMethodSchema = typeof PaymentMethodSchema,
> implements
    CheckoutFactory<TCheckoutSchema, TShippingMethodSchema, TPaymentMethodSchema>
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
    context: RequestContext,
    data: CTCart,
  ): z.output<TCheckoutSchema> {
    const identifier = {
      key: data.id,
      version: data.version || 0,
    } satisfies CommercetoolsCheckoutIdentifier;

    const originalCartReference = {
      key: data.custom?.fields['commerceToolsCartId'] || '',
      version: 0,
    } satisfies CommercetoolsCartIdentifier;

    let shippingAddress: Address | undefined;
    if (data.shippingAddress) {
      shippingAddress = this.parseAddress(data.shippingAddress);
    }

    let billingAddress: Address | undefined;
    if (data.billingAddress) {
      billingAddress = this.parseAddress(data.billingAddress);
    }

    const paymentInstructions: PaymentInstruction[] = [];
    for (const payment of data.paymentInfo?.payments || []) {
      if (payment.obj) {
        paymentInstructions.push(this.parsePaymentInstruction(context, payment.obj));
      }
    }

    const grandTotal = data.totalPrice.centAmount || 0;
    const shippingTotal = data.shippingInfo?.price.centAmount || 0;
    const productTotal = grandTotal - shippingTotal;
    const taxTotal = data.taxedPrice?.totalTax?.centAmount || 0;
    const discountTotal = data.discountOnTotalPrice?.discountedAmount.centAmount || 0;
    const surchargeTotal = 0;
    const currency = data.totalPrice.currencyCode as Currency;

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
        currency,
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

    const items: CheckoutItem[] = [];
    for (const lineItem of data.lineItems) {
      items.push(this.parseCheckoutItem(lineItem));
    }

    const shippingInstruction = this.parseShippingInstruction(data);
    const readyForFinalization = this.isReadyForFinalization(
      price,
      paymentInstructions,
      billingAddress,
      shippingAddress,
      shippingInstruction,
    );

    const result = {
      identifier,
      originalCartReference,
      name: data.custom?.fields['name'] || '',
      description: data.custom?.fields['description'] || '',
      readyForFinalization,
      billingAddress,
      shippingAddress,
      shippingInstruction,
      paymentInstructions,
      items,
      price,
    } satisfies Checkout;

    return this.checkoutSchema.parse(result);
  }

  public parseShippingMethod(
    context: RequestContext,
    data: CTShippingMethod,
  ): z.output<TShippingMethodSchema> {
    const identifier = {
      key: data.key || '',
    } satisfies ShippingMethodIdentifier;

    const result = {
      deliveryTime: '',
      description: data.localizedDescription?.[context.languageContext.locale] || '',
      identifier,
      name: data.name,
      price: data.zoneRates[0].shippingRates[0].price
        ? {
            value: (data.zoneRates[0].shippingRates[0].price.centAmount || 0) / 100,
            currency:
              (data.zoneRates[0].shippingRates[0].price.currencyCode as Currency) ||
              context.languageContext.currencyCode,
          }
        : { value: 0, currency: context.languageContext.currencyCode },
    } satisfies ShippingMethod;

    return this.shippingMethodSchema.parse(result);
  }

  public parsePaymentMethod(
    _context: RequestContext,
    data: PaymentMethod,
  ): z.output<TPaymentMethodSchema> {
    return this.paymentMethodSchema.parse(data);
  }

  protected parseCheckoutItem(remoteItem: LineItem): CheckoutItem {
    const unitPrice = remoteItem.price.value.centAmount;
    const totalPrice = remoteItem.totalPrice.centAmount || 0;
    const totalDiscount = remoteItem.price.discounted?.value.centAmount || 0;
    const unitDiscount = totalDiscount / remoteItem.quantity;
    const currency = remoteItem.price.value.currencyCode.toUpperCase() as Currency;

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
          value: totalPrice / 100,
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

  protected isReadyForFinalization(
    price: CostBreakDown,
    paymentInstructions: PaymentInstruction[],
    billingAddress?: Address,
    shippingAddress?: Address,
    shippingInstruction?: ShippingInstruction,
  ): boolean {
    if (!billingAddress) return false;
    if (!shippingInstruction) return false;
    if (!shippingAddress && !shippingInstruction.pickupPoint) return false;
    if (paymentInstructions.length === 0) return false;

    const authorizedPayments = paymentInstructions
      .filter((paymentInstruction) => paymentInstruction.status === 'authorized')
      .map((paymentInstruction) => paymentInstruction.amount.value)
      .reduce((sum, value) => sum + value, 0);

    if (price.grandTotal.value !== authorizedPayments) return false;

    return true;
  }

  protected parsePaymentInstruction(
    context: RequestContext,
    data: CTPayment,
  ): PaymentInstruction {
    const identifier = {
      key: data.id,
    } satisfies PaymentInstructionIdentifier;

    const amount = {
      value: data.amountPlanned.centAmount / 100,
      currency: data.amountPlanned.currencyCode as Currency,
    } satisfies MonetaryAmount;

    const method = data.paymentMethodInfo?.method || 'unknown';
    const paymentProcessor = data.paymentMethodInfo?.paymentInterface || method;
    const paymentName = data.paymentMethodInfo.name?.[context.languageContext.locale];

    const paymentMethod = {
      method,
      paymentProcessor,
      name: paymentName || method || 'Unknown',
    } satisfies PaymentMethodIdentifier;

    const customData = data.custom?.fields || {};
    const protocolData = Object.keys(customData).map((key) => ({
      key,
      value: customData[key],
    }));

    let status: PaymentStatus = 'pending';
    if (data.transactions && data.transactions.length > 0) {
      const lastTransaction = data.transactions[data.transactions.length - 1];
      if (
        lastTransaction.type === 'Authorization' &&
        lastTransaction.state === 'Success'
      ) {
        status = 'authorized';
      }
    }

    const result = {
      amount,
      identifier,
      paymentMethod,
      protocolData,
      status,
    } satisfies PaymentInstruction;

    return result;
  }

  protected parseAddress(data: CTAddress): Address {
    return {
      countryCode: data.country || '',
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      streetAddress: data.streetName || '',
      streetNumber: data.streetNumber || '',
      postalCode: data.postalCode || '',
      city: data.city || '',
      identifier: {
        nickName: '',
      },
      region: '',
    } satisfies Address;
  }

  protected parseShippingInstruction(data: CTCart): ShippingInstruction | undefined {
    if (!data.shippingInfo) return undefined;

    const instructions = data.custom?.fields['shippingInstruction'] || '';
    const consentForUnattendedDelivery =
      data.custom?.fields['consentForUnattendedDelivery'] === 'true';
    const pickupPoint = data.custom?.fields['pickupPointId'] || '';

    const result = {
      shippingMethod: {
        key: data.shippingInfo.shippingMethod?.obj?.key || '',
      },
      pickupPoint,
      instructions,
      consentForUnattendedDelivery,
    } satisfies ShippingInstruction;

    return result;
  }
}
