import 'dotenv/config';
import type {
  Cart, RequestContext
} from '@reactionary/core';
import {
  CartPaymentInstructionSchema,
  CartSchema,
  IdentitySchema,
  NoOpCache, OrderPaymentInstructionSchema, OrderSchema, createInitialRequestContext
} from '@reactionary/core';
import {
  getCommercetoolsTestConfiguration,
} from './test-utils';
import { CommercetoolsIdentityProvider } from '../providers/identity.provider';
import { CommercetoolsOrderProvider } from '../providers/order.provider';
import { CommercetoolsOrderPaymentProvider } from '../providers/order-payment.provider';
import { CommercetoolsCartProvider } from '../providers/cart.provider';
import { CommercetoolsCartPaymentProvider } from '../providers/cart-payment.provider';
const testData = {
  skuWithoutTiers: 'SGB-01',
  skuWithTiers: 'GMCT-01',
};

describe('Commercetools Order Payment Provider', () => {
  let provider: CommercetoolsOrderPaymentProvider;
  let orderProvider: CommercetoolsOrderProvider;
  let cartProvider: CommercetoolsCartProvider;
  let cartPaymentProvider: CommercetoolsCartPaymentProvider;
  let identityProvider: CommercetoolsIdentityProvider;
  let reqCtx: RequestContext;

  beforeAll(() => {
    provider = new CommercetoolsOrderPaymentProvider(
      getCommercetoolsTestConfiguration(),
      OrderPaymentInstructionSchema,
      new NoOpCache()
    );
    orderProvider = new CommercetoolsOrderProvider(
      getCommercetoolsTestConfiguration(),
      OrderSchema,
      new NoOpCache()
    );
    identityProvider = new CommercetoolsIdentityProvider(
      getCommercetoolsTestConfiguration(),
      IdentitySchema,
      new NoOpCache()
    );

    cartProvider = new CommercetoolsCartProvider(
      getCommercetoolsTestConfiguration(),
      CartSchema,
      new NoOpCache()
    );

    cartPaymentProvider = new CommercetoolsCartPaymentProvider(
      getCommercetoolsTestConfiguration(),
      CartPaymentInstructionSchema,
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
      cart = await cartProvider.setBillingAddress({
        cart: cart.identifier,
        billingAddress: {
          identifier: { nickName: 'billing-address' },
          firstName: 'Test',
          lastName: 'Testerson',
          streetAddress: 'Streetway',
          streetNumber: '1',
          city: 'Test city',
          region: 'Test region',
          postalCode: '12345',
          countryCode: 'US'
        },
        notificationEmailAddress: 'test@example.com',
        notificationPhoneNumber: '+4512345678'
      }, reqCtx);

      cart = await cartProvider.setShippingInfo({
        cart: cart.identifier,
        shippingAddress: {
          identifier: { nickName: 'shipping-address' },
          firstName: 'Test',
          lastName: 'Testerson',
          streetAddress: 'Streetway',
          streetNumber: '1',
          city: 'Test city',
          region: 'Test region',
          postalCode: '12345',
          countryCode: 'US'
        }
      }, reqCtx);

      const payment = await cartPaymentProvider.initiatePaymentForCart(
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
    });

    it('can checkout a cart with a payment', async () => {
      const order = await cartProvider.checkout(
        {
          cart: cart.identifier,
        },
        reqCtx
      );

      expect(order.key).toBeDefined();

      // load the orders payments
      const payments = await provider.getByOrderIdentifier(
        { order: order, status: undefined },
        reqCtx
      );
      expect(payments.length).toBe(1);
      expect(payments[0].identifier.key).toBeDefined();
    });


    it('will eventually have a stripe secret associated with it', async () => {
      const order = await cartProvider.checkout(
        {
          cart: cart.identifier,
        },
        reqCtx
      );

      expect(order.key).toBeDefined();

      for(const attempt of [1,2,3,4,5,6,7,8,9,10]) {
        // load the orders payments
        const payments = await provider.getByOrderIdentifier(
          { order: order, status: undefined },
          reqCtx
        );
        expect(payments.length).toBe(1);
        expect(payments[0].identifier.key).toBeDefined();
        if(payments[0].protocolData?.find(x => x.key === 'stripe_clientSecret')) {
          // found it, all good.
          return;
        }
        // wait a bit and try again.
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
      fail('No stripe secret found on payment after multiple attempts');
    });
  });
});
