import {
  CheckoutProvider,
  type Checkout,
  type CheckoutMutationAddPaymentInstruction,
  type CheckoutMutationFinalizeCheckout,
  type CheckoutMutationInitiateCheckout,
  type CheckoutMutationRemovePaymentInstruction,
  type CheckoutMutationSetShippingAddress,
  type CheckoutMutationSetShippingInstruction,
  type CheckoutQueryById,
  type CheckoutQueryForAvailablePaymentMethods,
  type CheckoutQueryForAvailableShippingMethods,
  type NotFoundError,
  type PaymentMethod,
  type RequestContext,
  type Result,
  type ShippingMethod,
  type Cache,
  Reactionary,
  CheckoutMutationInitiateCheckoutSchema,
  CheckoutSchema,
  CheckoutQueryByIdSchema,
  CheckoutMutationSetShippingAddressSchema,
  CheckoutQueryForAvailableShippingMethodsSchema,
  CheckoutQueryForAvailablePaymentMethodsSchema,
  CheckoutMutationAddPaymentInstructionSchema,
  CheckoutMutationRemovePaymentInstructionSchema,
  CheckoutMutationSetShippingInstructionSchema,
  CheckoutMutationFinalizeCheckoutSchema,
  success,
  type CheckoutIdentifier,
  PaymentMethodSchema,
  ShippingMethodSchema,
} from '@reactionary/core';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import { base, en, Faker } from '@faker-js/faker';
import z from 'zod';

export class FakeCheckoutProvider extends CheckoutProvider {
  protected config: FakeConfiguration;
  protected generator: Faker;

  constructor(
    config: FakeConfiguration,
    cache: Cache,
    context: RequestContext
  ) {
    super(cache, context);

    this.config = config;

    this.generator = new Faker({
      locale: [en, base],
      seed: config.seeds.product,
    });
  }

  @Reactionary({
    inputSchema: CheckoutMutationInitiateCheckoutSchema,
    outputSchema: CheckoutSchema,
  })
  public override async initiateCheckoutForCart(
    payload: CheckoutMutationInitiateCheckout
  ): Promise<Result<Checkout>> {
    const checkout = this.composeBaseCheckout(payload.cart.identifier);

    return success(checkout);
  }

  @Reactionary({
    inputSchema: CheckoutQueryByIdSchema,
    outputSchema: CheckoutSchema,
  })
  public override async getById(
    payload: CheckoutQueryById
  ): Promise<Result<Checkout, NotFoundError>> {
    const checkout = this.composeBaseCheckout(payload.identifier);

    return success(checkout);
  }

  @Reactionary({
    inputSchema: CheckoutMutationSetShippingAddressSchema,
    outputSchema: CheckoutSchema,
  })
  public override async setShippingAddress(
    payload: CheckoutMutationSetShippingAddress
  ): Promise<Result<Checkout>> {
    const checkout = this.composeBaseCheckout(payload.checkout);

    return success(checkout);
  }

  @Reactionary({
    inputSchema: CheckoutQueryForAvailableShippingMethodsSchema,
    outputSchema: z.array(ShippingMethodSchema),
  })
  public override async getAvailableShippingMethods(
    payload: CheckoutQueryForAvailableShippingMethods
  ): Promise<Result<ShippingMethod[]>> {
    const methods = [
      {
        name: 'Fake',
        deliveryTime: '3 days',
        description: 'A fake delivery by fake mail',
        identifier: {
          key: 'fake-001',
        },
        price: {
          currency: 'USD',
          value: 500,
        },
        carrier: 'Faker',
      },
    ] satisfies Array<ShippingMethod>;

    return success(methods);
  }

  @Reactionary({
    inputSchema: CheckoutQueryForAvailablePaymentMethodsSchema,
    outputSchema: z.array(PaymentMethodSchema),
  })
  public override async getAvailablePaymentMethods(
    payload: CheckoutQueryForAvailablePaymentMethods
  ): Promise<Result<PaymentMethod[]>> {
    const methods = [
      {
        description: 'A fake payment method for paying at some point',
        identifier: {
          method: 'PayLater',
          name: 'Pay Later',
          paymentProcessor: 'Faker',
        },
        isPunchOut: false,
      },
    ] satisfies Array<PaymentMethod>;

    return success(methods);
  }

  @Reactionary({
    inputSchema: CheckoutMutationAddPaymentInstructionSchema,
    outputSchema: CheckoutSchema,
  })
  public override async addPaymentInstruction(
    payload: CheckoutMutationAddPaymentInstruction
  ): Promise<Result<Checkout>> {
    const checkout = this.composeBaseCheckout(payload.checkout);

    return success(checkout);
  }

  @Reactionary({
    inputSchema: CheckoutMutationRemovePaymentInstructionSchema,
    outputSchema: CheckoutSchema,
  })
  public override async removePaymentInstruction(
    payload: CheckoutMutationRemovePaymentInstruction
  ): Promise<Result<Checkout>> {
    const checkout = this.composeBaseCheckout(payload.checkout);

    return success(checkout);
  }

  @Reactionary({
    inputSchema: CheckoutMutationSetShippingInstructionSchema,
    outputSchema: CheckoutSchema,
  })
  public override async setShippingInstruction(
    payload: CheckoutMutationSetShippingInstruction
  ): Promise<Result<Checkout>> {
    const checkout = this.composeBaseCheckout(payload.checkout);

    return success(checkout);
  }

  @Reactionary({
    inputSchema: CheckoutMutationFinalizeCheckoutSchema,
    outputSchema: CheckoutSchema,
  })
  public override async finalizeCheckout(
    payload: CheckoutMutationFinalizeCheckout
  ): Promise<Result<Checkout>> {
    const checkout = this.composeBaseCheckout(payload.checkout);

    return success(checkout);
  }

  protected composeBaseCheckout(identifier?: CheckoutIdentifier) {
    const checkout = {
      description: 'Fake Checkout',
      identifier: identifier || {
        key: this.generator.string.uuid(),
      },
      items: [],
      name: 'Fake Checkout',
      originalCartReference: {
        key: this.generator.string.uuid(),
      },
      paymentInstructions: [],
      price: {
        grandTotal: {
          currency: 'USD',
          value: this.generator.number.float({
            min: 100,
            max: 10000,
            multipleOf: 25
          }),
        },
        totalDiscount: {
          currency: 'USD',
          value: this.generator.number.float({
            min: 100,
            max: 10000,
            multipleOf: 25,
          }),
        },
        totalProductPrice: {
          currency: 'USD',
          value: this.generator.number.float({
            min: 100,
            max: 10000,
            multipleOf: 25
          }),
        },
        totalShipping: {
          currency: 'USD',
          value: this.generator.number.float({
            min: 100,
            max: 10000,
            multipleOf: 25
          }),
        },
        totalSurcharge: {
          currency: 'USD',
          value: this.generator.number.float({
            min: 100,
            max: 10000,
            multipleOf: 25
          }),
        },
        totalTax: {
          currency: 'USD',
          value: this.generator.number.float({
            min: 100,
            max: 10000,
            multipleOf: 25
          }),
        },
      },
      readyForFinalization: false,
    } satisfies Checkout;

    return checkout;
  }
}
