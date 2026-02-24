import type {
  Address,
  Checkout,
  CheckoutIdentifier,
  CheckoutItem,
  CostBreakDown,
  Currency,
  MonetaryAmount,
  PaymentInstruction,
  PaymentInstructionIdentifier,
  PaymentMethodIdentifier,
  PaymentStatus,
  ShippingInstruction,
  ShippingMethod,
  ShippingMethodIdentifier,
} from '@reactionary/core';
import { CheckoutItemSchema } from '@reactionary/core';
import type {
  Address as CTAddress,
  Cart as CTCart,
  LineItem,
  Payment as CTPayment,
  ShippingMethod as CTShippingMethod,
} from '@commercetools/platform-sdk';

type VersionedCheckoutIdentifier = CheckoutIdentifier & { version: number };
type VersionedCartIdentifier = { key: string; version: number };

export function parseCommercetoolsAddress(remote: CTAddress): Address {
  return {
    countryCode: remote.country || '',
    firstName: remote.firstName || '',
    lastName: remote.lastName || '',
    streetAddress: remote.streetName || '',
    streetNumber: remote.streetNumber || '',
    postalCode: remote.postalCode || '',
    city: remote.city || '',
    identifier: {
      nickName: '',
    },
    region: '',
  } satisfies Address;
}

export function parseCommercetoolsShippingMethods(
  methods: CTShippingMethod[],
  locale: string,
  currency: Currency,
): ShippingMethod[] {
  return methods.map((sm) => {
    const identifier = {
      key: sm.key || sm.id,
    } satisfies ShippingMethodIdentifier;

    return {
      deliveryTime: '',
      description: sm.localizedDescription?.[locale] || '',
      identifier,
      name: sm.name,
      price: sm.zoneRates[0]?.shippingRates[0]?.price
        ? {
            value: (sm.zoneRates[0].shippingRates[0].price.centAmount || 0) / 100,
            currency: (sm.zoneRates[0].shippingRates[0].price.currencyCode as Currency) || currency,
          }
        : { value: 0, currency },
    } satisfies ShippingMethod;
  });
}

export function parseCommercetoolsCheckoutItem(remoteItem: LineItem): CheckoutItem {
  const unitPrice = remoteItem.price.value.centAmount;
  const totalPrice = remoteItem.totalPrice.centAmount || 0;
  const totalDiscount = remoteItem.price.discounted?.value.centAmount || 0;
  const unitDiscount = totalDiscount / remoteItem.quantity;
  const currency = remoteItem.price.value.currencyCode.toUpperCase() as Currency;

  return CheckoutItemSchema.parse({
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
  } satisfies CheckoutItem);
}

export function parseCommercetoolsPaymentInstruction(remote: CTPayment, locale: string): PaymentInstruction {
  const identifier = {
    key: remote.id,
  } satisfies PaymentInstructionIdentifier;
  const amount = {
    value: remote.amountPlanned.centAmount / 100,
    currency: remote.amountPlanned.currencyCode as Currency,
  } satisfies MonetaryAmount;

  const method = remote.paymentMethodInfo?.method || 'unknown';
  const paymentProcessor = remote.paymentMethodInfo?.paymentInterface || method;
  const paymentName = remote.paymentMethodInfo?.name?.[locale];

  const paymentMethod = {
    method,
    paymentProcessor,
    name: paymentName || method || 'Unknown',
  } satisfies PaymentMethodIdentifier;

  const customData = remote.custom?.fields || {};
  const protocolData = Object.keys(customData).map((key) => ({ key, value: customData[key] }));

  let status: PaymentStatus = 'pending';
  if (remote.transactions && remote.transactions.length > 0) {
    const lastTransaction = remote.transactions[remote.transactions.length - 1];
    if (lastTransaction.type === 'Authorization' && lastTransaction.state === 'Success') {
      status = 'authorized';
    }
  }

  return {
    amount,
    identifier,
    paymentMethod,
    protocolData,
    status,
  } satisfies PaymentInstruction;
}

export function parseCommercetoolsShippingInstruction(remote: CTCart): ShippingInstruction | undefined {
  if (!remote.shippingInfo) {
    return undefined;
  }

  return {
    shippingMethod: {
      key: remote.shippingInfo.shippingMethod?.obj?.key || '',
    },
    pickupPoint: remote.custom?.fields['pickupPointId'] || '',
    instructions: remote.custom?.fields['shippingInstruction'] || '',
    consentForUnattendedDelivery: remote.custom?.fields['consentForUnattendedDelivery'] === 'true' || false,
  } satisfies ShippingInstruction;
}

export function isCheckoutReadyForFinalization(
  price: CostBreakDown,
  paymentInstructions: PaymentInstruction[],
  billingAddress?: Address,
  shippingAddress?: Address,
  shippingInstruction?: ShippingInstruction,
): boolean {
  if (!billingAddress) {
    return false;
  }
  if (!shippingInstruction) {
    return false;
  }
  if (!shippingAddress && !shippingInstruction.pickupPoint) {
    return false;
  }
  if (paymentInstructions.length === 0) {
    return false;
  }

  const authorizedPayments = paymentInstructions
    .filter((instruction) => instruction.status === 'authorized')
    .map((instruction) => instruction.amount.value)
    .reduce((a, b) => a + b, 0);

  return price.grandTotal.value === authorizedPayments;
}

export function parseCommercetoolsCheckout(remote: CTCart, locale: string): Checkout {
  const identifier = {
    key: remote.id,
    version: remote.version || 0,
  } satisfies VersionedCheckoutIdentifier;

  const originalCartReference = {
    key: remote.custom?.fields['commerceToolsCartId'] || '',
    version: 0,
  } satisfies VersionedCartIdentifier;

  const shippingAddress = remote.shippingAddress ? parseCommercetoolsAddress(remote.shippingAddress) : undefined;
  const billingAddress = remote.billingAddress ? parseCommercetoolsAddress(remote.billingAddress) : undefined;

  const paymentInstructions = (remote.paymentInfo?.payments || [])
    .filter((payment) => !!payment.obj)
    .map((payment) => parseCommercetoolsPaymentInstruction(payment.obj!, locale));

  const grandTotal = remote.totalPrice.centAmount || 0;
  const shippingTotal = remote.shippingInfo?.price.centAmount || 0;
  const productTotal = grandTotal - shippingTotal;
  const taxTotal = remote.taxedPrice?.totalTax?.centAmount || 0;
  const discountTotal = remote.discountOnTotalPrice?.discountedAmount.centAmount || 0;
  const surchargeTotal = 0;
  const currency = remote.totalPrice.currencyCode as Currency;

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

  const items = remote.lineItems.map(parseCommercetoolsCheckoutItem);
  const shippingInstruction = parseCommercetoolsShippingInstruction(remote);
  const readyForFinalization = isCheckoutReadyForFinalization(
    price,
    paymentInstructions,
    billingAddress,
    shippingAddress,
    shippingInstruction,
  );

  return {
    identifier,
    originalCartReference,
    name: remote.custom?.fields['name'] || '',
    description: remote.custom?.fields['description'] || '',
    readyForFinalization,
    billingAddress,
    shippingAddress,
    shippingInstruction,
    paymentInstructions,
    items,
    price,
  } satisfies Checkout;
}
