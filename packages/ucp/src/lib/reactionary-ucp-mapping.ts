import type {
  Address,
  Cart,
  Checkout,
  CostBreakDown,
  MonetaryAmount,
} from '@reactionary/core';
import type { components } from './ucp-shopping.openapi.js';
import type { UCPPaymentHandlers } from './reactionary-ucp-common.js';

export const UCP_VERSION = '2026-08-25';

export type UCPCheckout = components['schemas']['checkout'];
export type UCPLineItem = components['schemas']['line_item'];
export type UCPMessage = components['schemas']['message'];
export type UCPTotal = components['schemas']['total'];
export type UCPPostalAddress = components['schemas']['postal_address'];
export type UCPSelectedPaymentInstrument = NonNullable<
  NonNullable<UCPCheckout['payment']>['instruments']
>[number];

type UCPCheckoutPaymentHandlers = components['schemas']['response_checkout_schema']['payment_handlers'];

export function getSelectedPaymentInstrument(
  checkout: Pick<UCPCheckout, 'payment'>,
): UCPSelectedPaymentInstrument | undefined {
  const instruments = checkout.payment?.instruments ?? [];

  return instruments.find((instrument) => instrument.selected) ?? instruments[0];
}

export function toReactionaryAddress(
  address: UCPPostalAddress,
): Omit<Address, 'identifier'> {
  return {
    firstName: address.first_name ?? '',
    lastName: address.last_name ?? '',
    streetAddress: address.street_address ?? '',
    streetNumber: '',
    city: address.address_locality ?? '',
    region: address.address_region ?? '',
    postalCode: address.postal_code ?? '',
    countryCode: address.address_country ?? '',
  };
}

export function toUcpCartLineItem(
  lineItem: Cart['items'][number] | Checkout['items'][number],
): UCPLineItem {
  const sku = lineItem.variant.sku || lineItem.identifier.key;

  return {
    id: lineItem.identifier.key,
    item: {
      id: sku,
      title: sku,
      price: getMoneyValue(lineItem.price.unitPrice),
    },
    quantity: lineItem.quantity,
    totals: [
      {
        type: 'subtotal',
        amount: getMoneyValue({
          value: lineItem.price.unitPrice.value * lineItem.quantity,
          currency: lineItem.price.unitPrice.currency,
        }),
      },
      ...toUcpTotals(lineItem.price.totalPrice),
    ],
  };
}

export function toUcpCostTotals(
  price: CostBreakDown,
): UCPTotal[] {
  const totals: UCPTotal[] = [
    { type: 'subtotal', amount: getMoneyValue(price.totalProductPrice) },
  ];
  const optionalTotals: Array<[string, number]> = [
    ['discount', -Math.abs(getMoneyValue(price.totalDiscount))],
    ['fulfillment', getMoneyValue(price.totalShipping)],
    ['tax', getMoneyValue(price.totalTax)],
    ['fee', getMoneyValue(price.totalSurcharge)],
  ];

  for (const [type, amount] of optionalTotals) {
    if (amount !== 0) {
      totals.push({ type, amount });
    }
  }

  totals.push({ type: 'total', amount: getMoneyValue(price.grandTotal) });

  return totals;
}

export function toUcpTotals(
  amount: MonetaryAmount,
): UCPTotal[] {
  return [
    {
      type: 'total',
      amount: getMoneyValue(amount),
    },
  ];
}

// ISO 4217 exponents that differ from the common 2; UCP amounts are minor units.
const CURRENCY_EXPONENTS: Record<string, number> = {
  BIF: 0, CLP: 0, DJF: 0, GNF: 0, ISK: 0, JPY: 0, KMF: 0, KRW: 0, PYG: 0,
  RWF: 0, UGX: 0, UYI: 0, VND: 0, VUV: 0, XAF: 0, XOF: 0, XPF: 0,
  BHD: 3, IQD: 3, JOD: 3, KWD: 3, LYD: 3, OMR: 3, TND: 3,
};

export function getMoneyValue(
  amount: MonetaryAmount,
): number {
  const exponent = CURRENCY_EXPONENTS[amount.currency] ?? 2;

  return Math.round(amount.value * 10 ** exponent);
}

export function getMoneyCurrency(
  amount: MonetaryAmount,
): string {
  return amount.currency;
}

export function createUcpSuccessMetadata(): components['schemas']['ucp_$defs-base'] & { status: 'success' } {
  return {
    version: UCP_VERSION,
    status: 'success',
  };
}

export function createUcpCheckoutSuccessMetadata(
  paymentHandlers: UCPPaymentHandlers,
): components['schemas']['response_checkout_schema'] {
  const candidate: unknown = paymentHandlers;

  return {
    version: UCP_VERSION,
    status: 'success',
    payment_handlers: isUcpCheckoutPaymentHandlers(candidate) ? candidate : {},
  };
}

// The generated handler type is unsatisfiable by object literals, so validate the runtime shape instead of casting.
function isUcpCheckoutPaymentHandlers(
  value: unknown,
): value is UCPCheckoutPaymentHandlers {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value).every(
      (handlers: unknown) =>
        Array.isArray(handlers) &&
        handlers.every(
          (handler: unknown) =>
            typeof handler === 'object' &&
            handler !== null &&
            typeof Reflect.get(handler, 'version') === 'string',
        ),
    )
  );
}

export function createUcpErrorMessage(
  code: string,
  message: string,
  path?: string,
): UCPMessage {
  // Resources that do not exist cannot be retried against; everything else
  // can be resolved by adjusting the request.
  const unrecoverable = code.endsWith('not_found')
    || code === 'not_available'
    || code === 'not_implemented';

  return {
    type: 'error',
    code,
    ...(path ? { path } : {}),
    content_type: 'plain',
    content: message,
    severity: unrecoverable ? 'unrecoverable' : 'recoverable',
  };
}

export function createUCPError<TResponse>(
  code: string,
  message: string,
  path?: string,
): TResponse {
  return {
    ucp: {
      version: UCP_VERSION,
      status: 'error',
    },
    messages: [createUcpErrorMessage(code, message, path)],
  } as TResponse;
}

export function createUcpWarning(
  code: string,
  content: string,
  path: string,
): UCPMessage {
  return {
    type: 'warning',
    code,
    path,
    content,
    content_type: 'plain',
    presentation: 'notice',
  };
}
