import 'dotenv/config';
import {
  Cart,
  CartMutationAddPaymentMethodSchema,
  CartPaymentInstructionSchema,
  CartSchema,
  IdentitySchema,
  NoOpCache,
  Session,
} from '@reactionary/core';
import {
  createAnonymousTestSession,
  getCommercetoolsTestConfiguration,
} from './test-utils';
import { CommercetoolsCartProvider } from '../providers/cart.provider';
import { CommercetoolsIdentityProvider } from '../providers/identity.provider';
import { CommercetoolsCartPaymentProvider } from '../providers/cart-payment.provider';
import { CartPaymentMutationAddPayment } from 'core/src/schemas/mutations/cart-payment.mutation';

const testData = {
  skuWithoutTiers: 'SGB-01',
  skuWithTiers: 'GMCT-01',
};

describe('Commercetools Cart Payment Provider', () => {
  let provider: CommercetoolsCartPaymentProvider;
  let cartProvider: CommercetoolsCartProvider;
  let identityProvider: CommercetoolsIdentityProvider;
  let session: Session;

  beforeAll(() => {
    provider = new CommercetoolsCartPaymentProvider(
      getCommercetoolsTestConfiguration(),
      CartPaymentInstructionSchema,
      new NoOpCache()
    );
    cartProvider = new CommercetoolsCartProvider(
      getCommercetoolsTestConfiguration(),
      CartSchema,
      new NoOpCache()
    );
    identityProvider = new CommercetoolsIdentityProvider(
      getCommercetoolsTestConfiguration(),
      IdentitySchema,
      new NoOpCache()
    );
  });

  beforeEach(() => {
    session = createAnonymousTestSession();
  });

  describe('anonymous sessions', () => {
    let cart: Cart;

    beforeEach(async () => {
      cart = await cartProvider.add(
        {
          cart: { key: '', version: 0 },
          sku: {
            key: testData.skuWithoutTiers,
          },
          quantity: 1,
        },
        session
      );
    });

    it('a new cart will return 0 payment instructions', async () => {
      const payments = await provider.getByCartIdentifier(
        { cart: cart.identifier, status: undefined },
        session
      );
      expect(payments.length).toBe(0);
    });

    it('can initiate a new payment', async () => {
      const payment = await provider.initiatePaymentForCart(
        {
          cart: cart.identifier,
          paymentInstruction: {
            paymentMethod: {
              method: 'stripe',
              name: 'Stripe',
              paymentProcessor: 'stripe',
            },
            amount: {
              value: cart.price.grandTotal.value,
              currency: cart.price.grandTotal.currency,
            },
            protocolData: [{ key: 'test-key', value: 'test-value' }],
          },
        },
        session
      );

      expect(payment.identifier.key).toBeDefined();

      // verify that we can fetch it again.
      const payments = await provider.getByCartIdentifier(
        { cart: cart.identifier, status: undefined },
        session
      );
      expect(payments.length).toBe(1);
      expect(payments[0].identifier.key).toBe(payment.identifier.key);
    });


    it('can cancel an in-progress payment', async () => {
      const payment = await provider.initiatePaymentForCart(
        {
          cart: cart.identifier,
          paymentInstruction: {
            paymentMethod: {
              method: 'stripe',
              name: 'Stripe',
              paymentProcessor: 'stripe',
            },
            amount: {
              value: cart.price.grandTotal.value,
              currency: cart.price.grandTotal.currency,
            },
            protocolData: [{ key: 'test-key', value: 'test-value' }],
          },
        },
        session
      );
      expect(payment.identifier.key).toBeDefined();

      const cancelledPayment = await provider.cancelPaymentInstruction(
        {
          cart: cart.identifier,
          paymentInstruction: payment.identifier
        },
        session
      );
      expect(cancelledPayment.status).toBe('canceled');


      // verify that it is gone
      const payments = await provider.getByCartIdentifier(
        { cart: cart.identifier, status: undefined },
        session
      );
      expect(payments.length).toBe(0);
      expect(payments[0].identifier.key).toBe(payment.identifier.key);
   });
  });
});
