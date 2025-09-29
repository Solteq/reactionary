import 'dotenv/config';
import type {
  Cart, RequestContext} from '@reactionary/core';
import { CartPaymentInstructionSchema,
  CartSchema,
  IdentitySchema,
  NoOpCache, createInitialRequestContext
} from '@reactionary/core';
import {
  getCommercetoolsTestConfiguration,
} from './test-utils';
import { CommercetoolsCartProvider } from '../providers/cart.provider';
import { CommercetoolsIdentityProvider } from '../providers/identity.provider';
import { CommercetoolsCartPaymentProvider } from '../providers/cart-payment.provider';

const testData = {
  skuWithoutTiers: 'SGB-01',
  skuWithTiers: 'GMCT-01',
};

describe('Commercetools Cart Payment Provider', () => {
  let provider: CommercetoolsCartPaymentProvider;
  let cartProvider: CommercetoolsCartProvider;
  let identityProvider: CommercetoolsIdentityProvider;
  let reqCtx: RequestContext;

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
    reqCtx = createInitialRequestContext();
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
        reqCtx
      );
    });

    it('a new cart will return 0 payment instructions', async () => {
      const payments = await provider.getByCartIdentifier(
        { cart: cart.identifier, status: undefined },
        reqCtx
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
        reqCtx
      );

      expect(payment.identifier.key).toBeDefined();

      // verify that we can fetch it again.
      const payments = await provider.getByCartIdentifier(
        { cart: cart.identifier, status: undefined },
        reqCtx
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
        reqCtx
      );
      expect(payment.identifier.key).toBeDefined();

      const cancelledPayment = await provider.cancelPaymentInstruction(
        {
          cart: cart.identifier,
          paymentInstruction: payment.identifier
        },
        reqCtx
      );
      expect(cancelledPayment.status).toBe('canceled');


      // verify that it is gone
      const payments = await provider.getByCartIdentifier(
        { cart: cart.identifier, status: undefined },
        reqCtx
      );
      expect(payments.length).toBe(0);
      expect(payments[0].identifier.key).toBe(payment.identifier.key);
   });
  });
});
