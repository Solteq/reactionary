import {
  AddressIdentifierSchema,
  CurrencySchema,
  MonetaryAmountSchema,
  PaymentStatusSchema,
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
  type PaymentStatus,
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
  MagentoStoredPaymentInstruction,
} from '../../schema/magento.types.js';
import type { MagentoShippingMethodData } from '../../schema/checkout.types.js';

export interface MagentoCheckoutData {
  cart: MagentoCart;
  totals?: MagentoCartTotals;
  state?: MagentoCheckoutState;
  requestedKey?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMagentoCheckoutData(data: unknown): data is MagentoCheckoutData {
  return isRecord(data) && isRecord(data['cart']);
}

function isMagentoShippingMethod(data: unknown): data is MagentoShippingMethodData {
  return (
    isRecord(data) &&
    typeof data['carrier_code'] === 'string' &&
    typeof data['method_code'] === 'string'
  );
}

function isMagentoPaymentMethod(data: unknown): data is MagentoPaymentMethod {
  return (
    isRecord(data) &&
    typeof data['code'] === 'string' &&
    typeof data['title'] === 'string'
  );
}

/** Total segment codes of payment-fee / surcharge modules. */
const SURCHARGE_SEGMENT_PATTERN = /fee|surcharge/i;

/** A delivery estimate in a rate title, e.g. "Ground (3-5 business days)". */
const DELIVERY_TIME_PATTERN =
  /\d+(?:\s*(?:-|–|to)\s*\d+)?\s*(?:business\s+|working\s+)?days?/i;

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
    return this.toCurrency(
      data.totals?.quote_currency_code ||
        data.cart.quote_currency_code ||
        data.cart.currency?.quote_currency_code,
    );
  }

  /** A currency code, else the configured default currency, else USD. */
  protected toCurrency(code: string | undefined): Currency {
    for (const candidate of [code, this.config.defaultCurrency]) {
      const parsed = CurrencySchema.safeParse(candidate);
      if (parsed.success) {
        return parsed.data;
      }
    }
    return 'USD';
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
        value: (data.totals?.total_segments ?? [])
          .filter((s) => SURCHARGE_SEGMENT_PATTERN.test(s.code))
          .reduce((sum, s) => sum + (s.value ?? 0), 0),
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

  /**
   * The stored status, if it is a payment status. Magento authorizes (or,
   * with an authorize-and-capture payment action, captures) the payment when
   * the order is placed, so an instruction still marked pending once an order
   * exists is reported as authorized.
   */
  protected parsePaymentStatus(
    stored: MagentoStoredPaymentInstruction,
    hasOrder: boolean,
  ): PaymentStatus {
    const parsed = PaymentStatusSchema.safeParse(stored.status);
    const status = parsed.success ? parsed.data : 'pending';
    return hasOrder && status === 'pending' ? 'authorized' : status;
  }

  protected parsePaymentInstruction(
    stored: MagentoStoredPaymentInstruction,
    hasOrder = false,
  ): PaymentInstruction {
    return {
      identifier: { key: stored.key },
      amount: {
        value: stored.amountValue,
        currency: this.toCurrency(stored.amountCurrency),
      },
      paymentMethod: {
        method: stored.method,
        name: stored.name,
        paymentProcessor: stored.paymentProcessor,
      },
      protocolData: stored.protocolData,
      status: this.parsePaymentStatus(stored, hasOrder),
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
    if (!isMagentoCheckoutData(data)) {
      throw new Error('MagentoCheckoutFactory.parseCheckout expects MagentoCheckoutData');
    }
    const checkoutData = data;
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
      this.parsePaymentInstruction(pi, Boolean(state.orderId)),
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
    if (!isMagentoShippingMethod(data)) {
      throw new Error('MagentoCheckoutFactory.parseShippingMethod expects a Magento shipping rate');
    }
    const method = data;
    const currency = this.toCurrency(method.quote_currency_code);

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
      deliveryTime: this.parseDeliveryTime(method),
      carrier: method.carrier_code,
    };

    return this.shippingMethodSchema.parse(sm);
  }

  /**
   * Magento rates carry no delivery estimate. One exposed by an extension as
   * `extension_attributes.delivery_time` is used, else one written into the
   * method or carrier title ("Ground (3-5 business days)"), else none.
   */
  protected parseDeliveryTime(method: MagentoShippingMethodData): string {
    const attribute = method.extension_attributes?.['delivery_time'];
    if (typeof attribute === 'string' && attribute !== '') {
      return attribute;
    }
    for (const title of [method.method_title, method.carrier_title]) {
      const match = title?.match(DELIVERY_TIME_PATTERN);
      if (match) {
        return match[0];
      }
    }
    return '';
  }

  public parsePaymentMethod(
    _context: RequestContext,
    data: unknown,
  ): z.output<TPaymentMethodSchema> {
    if (!isMagentoPaymentMethod(data)) {
      throw new Error('MagentoCheckoutFactory.parsePaymentMethod expects a Magento payment method');
    }
    const method = data;

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
