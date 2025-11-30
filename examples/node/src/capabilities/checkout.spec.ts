import 'dotenv/config';
import type { Cart, Checkout } from '@reactionary/core';
import {
  PaymentInstructionSchema,
  ShippingInstructionSchema,
} from '@reactionary/core';
import { describe, expect, it, beforeEach } from 'vitest';
import { createClient, PrimaryProvider } from '../utils.js';

const testData = {
  skuWithoutTiers: '0766623301831',
  skuWithTiers: '0766623360203',
};

describe.each([PrimaryProvider.COMMERCETOOLS])('Checkout Capability - %s', (provider) => {
  let client: ReturnType<typeof createClient>;

  beforeEach(() => {
    client = createClient(provider);
  });

  describe('anonymous sessions', () => {
    let cart: Cart;

    beforeEach(async () => {
      cart = await client.cart.add(
        {
          cart: { key: '' },
          variant: {
            sku: testData.skuWithoutTiers,
          },
          quantity: 1,
        },
      );
    });

    it('can create a checkout session from a cart', async () => {
      //  we have either an anonymous user, or an authenticated user.
      // if it is anonymous, we assume you will have collected some basic info by now ?

      const checkout = await client.checkout.initiateCheckoutForCart(
        {
          cart: cart,
          billingAddress: {
            countryCode: 'US',
            firstName: 'John',
            lastName: 'Doe',
            streetAddress: '123 Main St',
            streetNumber: '1A',
            postalCode: '12345',
            city: 'Anytown',
            region: '',
          },
          notificationEmail: 'sample@example.com',
          notificationPhone: '+4512345678',
        }
      );

      expect(checkout.identifier.key).toBeDefined();
      expect(checkout.originalCartReference.key).toBe(cart.identifier.key);
      expect(checkout.billingAddress?.firstName).toBe('John');
      expect(checkout.items.length).toBe(1);
      expect(checkout.items[0].variant.sku).toBe(testData.skuWithoutTiers);
    });

    describe('checkout actions', () => {
      let checkout: Checkout;
      beforeEach(async () => {
        checkout = await client.checkout.initiateCheckoutForCart(
          {
            cart: cart,
            billingAddress: {
              countryCode: 'US',
              firstName: 'John',
              lastName: 'Doe',
              streetAddress: '123 Main St',
              streetNumber: '1A',
              postalCode: '12345',
              city: 'Anytown',
              region: '',
            },
            notificationEmail: 'sample@example.com',
            notificationPhone: '+4512345678',
          }
        );
      });

      it('can list payment methods', async () => {
        const paymentMethods = await client.checkout.getAvailablePaymentMethods(
          {
            checkout: checkout.identifier,
          }
        );
        expect(paymentMethods.length).toBeGreaterThan(0);
        expect(
          paymentMethods.find((x) => x.identifier.method === 'stripe')
        ).toBeDefined();
      });

      it('can list shipping methods', async () => {
        const shippingMethods = await client.checkout.getAvailableShippingMethods(
          {
            checkout: checkout.identifier,
          }
        );
        expect(shippingMethods.length).toBeGreaterThan(0);
        expect(
          shippingMethods.find((x) => x.identifier.key === 'us-delivery')
        ).toBeDefined();
      });

      it('can add a payment instruction', async () => {
        const paymentMethods = await client.checkout.getAvailablePaymentMethods(
          {
            checkout: checkout.identifier,
          }
        );
        const pm = paymentMethods.find((x) => x.identifier.method === 'stripe');
        expect(pm).toBeDefined();

        const checkoutWithPi = await client.checkout.addPaymentInstruction(
          {
            checkout: checkout.identifier,
            paymentInstruction: PaymentInstructionSchema.parse({
              paymentMethod: pm?.identifier,
              amount: checkout.price.grandTotal,
              protocolData: [{ key: 'test-key', value: 'test-value' }],
            }),
          }
        );

        expect(checkoutWithPi.paymentInstructions.length).toBe(1);
        expect(checkoutWithPi.paymentInstructions[0].paymentMethod.method).toBe(
          'stripe'
        );
        expect(checkoutWithPi.paymentInstructions[0].protocolData.find(x => x.key === 'stripe_clientSecret')?.value).toBeDefined();

      });

      it.skip('can cancel an in-progress payment', async () => {
        const paymentMethods = await client.checkout.getAvailablePaymentMethods(
          {
            checkout: checkout.identifier,
          }
        );
        const pm = paymentMethods.find((x) => x.identifier.method === 'stripe');
        expect(pm).toBeDefined();

        const checkoutWithPi = await client.checkout.addPaymentInstruction(
          {
            checkout: checkout.identifier,
            paymentInstruction: PaymentInstructionSchema.parse({
              paymentMethod: pm?.identifier,
              amount: checkout.price.grandTotal,
              protocolData: [{ key: 'test-key', value: 'test-value' }],
            }),
          }
        );

        expect(checkoutWithPi.paymentInstructions.length).toBe(1);

        const checkoutAfterCancel = await client.checkout.removePaymentInstruction(
          {
            checkout: checkout.identifier,
            paymentInstruction:
              checkoutWithPi.paymentInstructions[0].identifier,
          }
        );

        expect(checkoutAfterCancel.paymentInstructions.length).toBe(0);
      });

      it('can set shipping address', async () => {
        const checkoutWithShipping = await client.checkout.setShippingAddress(
          {
            checkout: checkout.identifier,
            shippingAddress: {
              countryCode: 'US',
              firstName: 'Jane',
              lastName: 'Doe',
              streetAddress: '456 Other St',
              streetNumber: '2B',
              postalCode: '54321',
              city: 'Othertown',
              region: '',
            },
          }
        );

        expect(checkoutWithShipping.shippingAddress).toBeDefined();
        expect(checkoutWithShipping.shippingAddress?.firstName).toBe('Jane');
      });

      it('can set shipping instructions', async () => {
        const shippingMethods = await client.checkout.getAvailableShippingMethods(
          {
            checkout: checkout.identifier,
          }
        );
        const sm = shippingMethods.find((x) => x.identifier.key === 'us-delivery');
        expect(sm).toBeDefined();

        const shippingInstruction = ShippingInstructionSchema.parse({
          shippingMethod: sm?.identifier || { key: '' },
          amount: checkout.price.totalShipping,
          instructions: 'Leave at front door if not home',
          consentForUnattendedDelivery: true,
          pickupPoint: '4190asx141', // this would be a real pickup point ID in a real scenario
        });

        const checkoutWithShipping = await client.checkout.setShippingInstruction(
          {
            checkout: checkout.identifier,
            shippingInstruction,
          }
        );

        expect(checkout.price.totalShipping.value).toBe(0);
        expect(checkoutWithShipping.price.totalShipping.value).toBeGreaterThan(0);
        expect(checkoutWithShipping.shippingInstruction).toBeDefined();
        expect(
          checkoutWithShipping.shippingInstruction?.shippingMethod.key
        ).toBe('us-delivery');
        expect(checkoutWithShipping.shippingInstruction?.instructions).toBe(
          'Leave at front door if not home'
        );
        expect(checkoutWithShipping.shippingInstruction?.pickupPoint).toBe(
          '4190asx141'
        );
        expect(
          checkoutWithShipping.shippingInstruction?.consentForUnattendedDelivery
        ).toBe(true);
      });

      it.skip('wont report it finalizable until everything is paid/authorized', async () => {
        expect(checkout.readyForFinalization).toBe(false);
        const pm = (
          await client.checkout.getAvailablePaymentMethods(
            {
              checkout: checkout.identifier,
            }
          )
        ).find((x) => x.identifier.method === 'stripe');
        expect(pm).toBeDefined();

        const checkoutWithPi = await client.checkout.addPaymentInstruction(
          {
            checkout: checkout.identifier,
            paymentInstruction: PaymentInstructionSchema.parse({
              paymentMethod: pm?.identifier,
              amount: checkout.price.grandTotal,
              protocolData: [{ key: 'test-key', value: 'test-value' }],
            }),
          }
        );

        // do something to simulate payment authorization ?
        const checkoutReady = await client.checkout.getById(
          { identifier: checkoutWithPi.identifier },
        );
        if (!checkoutReady) {
          expect.fail('checkout not found');
        }
        expect(checkoutReady.readyForFinalization).toBe(true);
      });
    });
  });
});
