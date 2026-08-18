import {
  AddressIdentifierSchema,
  MonetaryAmountSchema,
  ShippingMethodIdentifierSchema,
  type Address,
  type AnyCheckoutSchema,
  type AnyPaymentMethodSchema,
  type AnyShippingMethodSchema,
  type Checkout,
  type CheckoutFactory,
  type CheckoutItem,
  type CheckoutSchema,
  type CostBreakDown,
  type Currency,
  type ItemCostBreakdown,
  type PaymentInstruction,
  type PaymentMethod,
  type PaymentMethodSchema,
  type PointOfContact,
  type RequestContext,
  type ShippingInstruction,
  type ShippingMethod,
  type ShippingMethodSchema,
} from '@reactionary/core';
import type * as z from 'zod';
import type { MagentoConfiguration } from '../../schema/configuration.schema.js';
import type {
  MagentoCart,
  MagentoCartItem,
  MagentoCartTotals,
  MagentoCheckoutAddress,
  MagentoCheckoutState,
  MagentoPaymentMethod,
  MagentoShippingMethod,
  MagentoStoredPaymentInstruction,
} from '../../schema/magento.types.js';

export interface MagentoCheckoutData {
  cart: MagentoCart;
  totals?: MagentoCartTotals;
  state?: MagentoCheckoutState;
  requestedKey?: string;
}

/**
 * Builds a stable shipping-method identifier key from a Magento carrier/method
 * pair, and parses it back. Magento identifies a rate by both codes.
 */
export function encodeShippingMethodKey(
  carrierCode: string,
  methodCode: string,
): string {
  return `${carrierCode}_${methodCode}`;
}

export class MagentoCheckoutFactory<
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
  public readonly checkoutSchema: TCheckoutSchema;
  public readonly shippingMethodSchema: TShippingMethodSchema;
  public readonly paymentMethodSchema: TPaymentMethodSchema;
  protected readonly config: MagentoConfiguration;

  constructor(
    checkoutSchema: TCheckoutSchema,
    shippingMethodSchema: TShippingMethodSchema,
    paymentMethodSchema: TPaymentMethodSchema,
    config: MagentoConfiguration,
  ) {
    this.checkoutSchema = checkoutSchema;
    this.shippingMethodSchema = shippingMethodSchema;
    this.paymentMethodSchema = paymentMethodSchema;
    this.config = config;
  }

  protected resolveCurrency(data: MagentoCheckoutData): Currency {
    const code =
      data.totals?.quote_currency_code ||
      data.cart.quote_currency_code ||
      this.config.defaultCurrency ||
      'USD';
    return code as Currency;
  }

  protected parseAddress(address: MagentoCheckoutAddress): Address {
    const street = address.street ?? [];
    return {
      identifier: AddressIdentifierSchema.parse({
        nickName: address.company || '',
      }),
      firstName: address.firstname || '',
      lastName: address.lastname || '',
      streetAddress: street[0] || '',
      streetNumber: street[1] || '',
      city: address.city || '',
      region: address.region || '',
      postalCode: address.postcode || '',
      countryCode: address.country_id || '',
    };
  }

  protected parseCostBreakdown(
    data: MagentoCheckoutData,
    currency: Currency,
  ): CostBreakDown {
    const source: MagentoCartTotals = data.totals ?? data.cart;
    return {
      totalProductPrice: {
        value: source.subtotal ?? source.base_subtotal ?? 0,
        currency,
      },
      grandTotal: {
        value: source.grand_total ?? source.base_grand_total ?? 0,
        currency,
      },
      totalTax: {
        value: source.tax_amount ?? source.base_tax_amount ?? 0,
        currency,
      },
      totalShipping: {
        value: source.shipping_amount ?? source.base_shipping_amount ?? 0,
        currency,
      },
      totalDiscount: {
        value: Math.abs(source.discount_amount ?? source.base_discount_amount ?? 0),
        currency,
      },
      totalSurcharge: {
        value: 0,
        currency,
      },
    };
  }

  protected parseItemPrice(
    item: MagentoCartItem,
    currency: Currency,
  ): ItemCostBreakdown {
    const qty = item.qty ?? 0;
    return {
      unitPrice: {
        value: item.price ?? 0,
        currency,
      },
      unitDiscount: {
        value: item.discount_amount ? Math.abs(item.discount_amount / (qty || 1)) : 0,
        currency,
      },
      totalPrice: {
        value:
          item.row_total !== undefined
            ? item.row_total
            : (item.price || 0) * (qty || 0),
        currency,
      },
      totalDiscount: {
        value: Math.abs(item.discount_amount || 0),
        currency,
      },
    };
  }

  protected parseCheckoutItem(
    item: MagentoCartItem,
    currency: Currency,
  ): CheckoutItem {
    return {
      identifier: {
        key: String(item.item_id),
      },
      variant: {
        sku: item.sku,
      },
      quantity: item.qty ?? 0,
      price: this.parseItemPrice(item, currency),
    };
  }

  protected parsePaymentInstruction(
    stored: MagentoStoredPaymentInstruction,
  ): PaymentInstruction {
    return {
      identifier: { key: stored.key },
      amount: {
        value: stored.amountValue,
        currency: stored.amountCurrency as Currency,
      },
      paymentMethod: {
        method: stored.method,
        name: stored.name,
        paymentProcessor: stored.paymentProcessor,
      },
      protocolData: stored.protocolData,
      status: 'pending',
    };
  }

  protected parseShippingInstruction(
    state: MagentoCheckoutState,
  ): ShippingInstruction | undefined {
    if (!state.shippingInstruction) {
      return undefined;
    }
    return {
      shippingMethod: { key: state.shippingInstruction.shippingMethodKey },
      pickupPoint: state.shippingInstruction.pickupPoint,
      instructions: state.shippingInstruction.instructions,
      consentForUnattendedDelivery:
        state.shippingInstruction.consentForUnattendedDelivery,
    };
  }

  public parseCheckout(
    _context: RequestContext,
    data: unknown,
  ): z.output<TCheckoutSchema> {
    const checkoutData = data as MagentoCheckoutData;
    const cart = checkoutData.cart;
    const state = checkoutData.state ?? {};
    const currency = this.resolveCurrency(checkoutData);

    const key =
      checkoutData.requestedKey || cart.masked_id || String(cart.id || '');

    const items = (cart.items || []).map((item) =>
      this.parseCheckoutItem(item, currency),
    );

    const billingAddress = state.billingAddress
      ? this.parseAddress(state.billingAddress)
      : undefined;
    const shippingAddress = state.shippingAddress
      ? this.parseAddress(state.shippingAddress)
      : undefined;

    const paymentInstructions = (state.paymentInstructions ?? []).map((pi) =>
      this.parsePaymentInstruction(pi),
    );

    const readyForFinalization = Boolean(
      state.shippingInstruction &&
        paymentInstructions.length > 0 &&
        (billingAddress || shippingAddress),
    );

    const pointOfContact: PointOfContact = {
      email: state.email || cart.customer?.email || '',
      phone: state.phone,
    };

    const result: Checkout = {
      identifier: { key },
      originalCartReference: { key },
      resultingOrder: state.orderId ? { key: state.orderId } : undefined,
      items,
      price: this.parseCostBreakdown(checkoutData, currency),
      name: cart.name || '',
      description: cart.description || '',
      pointOfContact,
      billingAddress,
      shippingAddress,
      shippingInstruction: this.parseShippingInstruction(state),
      paymentInstructions,
      readyForFinalization,
    };

    return this.checkoutSchema.parse(result);
  }

  public parseShippingMethod(
    _context: RequestContext,
    data: unknown,
  ): z.output<TShippingMethodSchema> {
    const method = data as MagentoShippingMethod;
    const currency = (this.config.defaultCurrency || 'USD') as Currency;

    const sm: ShippingMethod = {
      identifier: ShippingMethodIdentifierSchema.parse({
        key: encodeShippingMethodKey(method.carrier_code, method.method_code),
      }),
      name: method.method_title || method.method_code,
      description: method.carrier_title || '',
      price: MonetaryAmountSchema.parse({
        value: method.amount ?? 0,
        currency,
      }),
      deliveryTime: '',
      carrier: method.carrier_code,
    };

    return this.shippingMethodSchema.parse(sm);
  }

  public parsePaymentMethod(
    _context: RequestContext,
    data: unknown,
  ): z.output<TPaymentMethodSchema> {
    const method = data as MagentoPaymentMethod;

    const pm: PaymentMethod = {
      identifier: {
        method: method.code,
        name: method.title,
        paymentProcessor: method.code,
      },
      logo: undefined,
      description: method.title,
      isPunchOut: false,
    };

    return this.paymentMethodSchema.parse(pm);
  }
}
