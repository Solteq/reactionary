import type { UCPTestPaymentHandler } from '@reactionary/ucp';

/**
 * The handler id the UCP conformance suite hardcodes in its AP2, token
 * binding and card credential tests.
 */
export const CONFORMANCE_MOCK_PAYMENT_HANDLER_ID = 'mock_payment_handler';

// The suite's mock tokens and test card numbers, mapped to the Stripe test
// PaymentMethods with the same outcome. Anything else is declined.
const STRIPE_TEST_PAYMENT_METHODS_BY_TOKEN: Record<string, string> = {
  success_token: 'pm_card_visa',
  fail_token: 'pm_card_visa_chargeDeclined',
};

const STRIPE_TEST_PAYMENT_METHODS_BY_CARD_NUMBER: Record<string, string> = {
  '4242424242424242': 'pm_card_visa',
  '5555555555554444': 'pm_card_mastercard',
  '4000000000000002': 'pm_card_visa_chargeDeclined',
};

/**
 * Completes the conformance suite's mock handler payments through a real
 * Stripe handler. Raw card numbers are only looked up, never forwarded.
 */
export function createConformanceMockPaymentHandler(stripeHandlerId: string): UCPTestPaymentHandler {
  return {
    id: CONFORMANCE_MOCK_PAYMENT_HANDLER_ID,
    delegateHandlerId: stripeHandlerId,
    resolveCredential(credential) {
      const paymentMethod = getStripeTestPaymentMethod(credential);

      return paymentMethod ? { type: 'token', token: paymentMethod } : undefined;
    },
  };
}

function getStripeTestPaymentMethod(credential: unknown): string | undefined {
  if (typeof credential !== 'object' || credential === null) {
    return undefined;
  }

  const type: unknown = Reflect.get(credential, 'type');
  const token: unknown = Reflect.get(credential, 'token');
  const number: unknown = Reflect.get(credential, 'number');

  if (type === 'token' && typeof token === 'string') {
    return STRIPE_TEST_PAYMENT_METHODS_BY_TOKEN[token];
  }

  if (type === 'card' && typeof number === 'string') {
    return STRIPE_TEST_PAYMENT_METHODS_BY_CARD_NUMBER[number];
  }

  return undefined;
}
