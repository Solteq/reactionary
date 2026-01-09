import 'dotenv/config';
import type { RequestContext } from '@reactionary/core';
import {
  CartSchema,
  IdentitySchema,
  NoOpCache,
  createInitialRequestContext,
} from '@reactionary/core';
import { getFakerTestConfiguration } from './test-utils.js';
import { FakeCartProvider } from '../providers/cart.provider.js';
import { FakeIdentityProvider } from '../providers/index.js';
import { describe, expect, it, beforeAll, beforeEach, assert } from 'vitest';
import { FakeCheckoutProvider } from '../providers/checkout.provider.js';

describe('Fake Checkout Provider', () => {
  let provider: FakeCheckoutProvider;
  let reqCtx: RequestContext;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    provider = new FakeCheckoutProvider(
      getFakerTestConfiguration(),
      new NoOpCache(),
      reqCtx
    );
  });

  describe('should have operations return structurally valid data', () => {
    it('for getById', async () => {
      const result = await provider.getById({
        identifier: {
          key: '1234',
        },
      });

      if (!result.success) {
        assert.fail();
      }

      expect(result.value.identifier.key).toBe('1234');
    });

    it('for addPaymentInstruction', async () => {
      const result = await provider.addPaymentInstruction({
        checkout: {
          key: '1234',
        },
        paymentInstruction: {
          amount: {
            currency: 'USD',
            value: 500,
          },
          paymentMethod: {
            method: 'PayLater',
            name: 'PayLater',
            paymentProcessor: 'Fake',
          },
          protocolData: [],
        },
      });

      if (!result.success) {
        assert.fail();
      }

      expect(result.value.identifier.key).toBe('1234');
    });
  });

  it('for removePaymentInstruction', async () => {
    const result = await provider.removePaymentInstruction({
      checkout: {
        key: '1234',
      },
      paymentInstruction: {
        key: '1234',
      },
    });

    if (!result.success) {
      assert.fail();
    }

    expect(result.value.identifier.key).toBe('1234');
  });

  it('for finalizeCheckout', async () => {
    const result = await provider.finalizeCheckout({
      checkout: {
        key: '1234',
      },
    });

    if (!result.success) {
      assert.fail();
    }

    expect(result.value.identifier.key).toBe('1234');
  });

  it('for setShippingAddress', async () => {
    const result = await provider.setShippingAddress({
        checkout: {
            key: '1234'
        },
        shippingAddress: {
            city: 'City',
            countryCode: 'DK',
            firstName: 'FirstName',
            lastName: 'LastName',
            postalCode: '2300',
            region: 'Region',
            streetAddress: 'StreetAddress',
            streetNumber: '42'
        }
    });

    if (!result.success) {
      assert.fail();
    }

    expect(result.value.identifier.key).toBe('1234');
  });

  it('for setShippingInstruction', async () => {
    const result = await provider.setShippingInstruction({
        checkout: {
            key: '1234'
        },
        shippingInstruction: {
            consentForUnattendedDelivery: false,
            instructions: 'Fake Instructions',
            pickupPoint: '',
            shippingMethod: {
                key: 'Fake Shipping'
            }
        }
    });

    if (!result.success) {
      assert.fail();
    }

    expect(result.value.identifier.key).toBe('1234');
  });

  it('for initiateCheckoutForCart', async () => {
    const result = await provider.initiateCheckoutForCart({
      cart: {
        identifier: {
            key: '1234'
        },
        description: 'Fake Cart',
        items: [],
        name: 'Fake Cart',
        price: {
            grandTotal: {
                currency: 'USD',
                value: 1500
            },
            totalDiscount: {
                currency: 'USD',
                value: 500
            },
            totalProductPrice: {
                currency: 'USD',
                value: 1500
            },
            totalShipping: {
                currency: 'USD',
                value: 500
            },
            totalSurcharge: {
                currency: 'USD',
                value: 0
            },
            totalTax: {
                currency: 'USD',
                value: 0
            }
        },
        userId: {
            userId: 'Fake'
        }
      },
    });

    if (!result.success) {
      assert.fail(JSON.stringify(result.error));
    }

    expect(result.value.identifier.key).toBe('1234');
  });

  it('for getAvailablePaymentMethods', async () => {
    const result = await provider.getAvailablePaymentMethods({
      checkout: {
        key: '1234',
      },
    });

    if (!result.success) {
      assert.fail();
    }

    expect(result.value.length).toBeGreaterThan(0);
  });

  it('for getAvailableShippingMethods', async () => {
    const result = await provider.getAvailableShippingMethods({
      checkout: {
        key: '1234',
      },
    });

    if (!result.success) {
      assert.fail();
    }

    expect(result.value.length).toBeGreaterThan(0);
  });
});
