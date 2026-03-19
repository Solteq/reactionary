import {
  CheckoutCapability,
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
  type CheckoutFactory,
  type CheckoutFactoryCheckoutOutput,
  type CheckoutFactoryPaymentMethodOutput,
  type CheckoutFactoryShippingMethodOutput,
  type CheckoutFactoryWithOutput,
  PaymentMethodSchema,
  ShippingMethodSchema,
} from '@reactionary/core';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import { base, en, Faker } from '@faker-js/faker';
import * as z from 'zod';
import type { FakeCheckoutFactory } from '../factories/checkout/checkout.factory.js';

export class FakeCheckoutCapability<
  TFactory extends CheckoutFactory = FakeCheckoutFactory,
> extends CheckoutCapability<
  CheckoutFactoryCheckoutOutput<TFactory>,
  CheckoutFactoryShippingMethodOutput<TFactory>,
  CheckoutFactoryPaymentMethodOutput<TFactory>
> {
  protected config: FakeConfiguration;
  protected generator: Faker;
  protected factory: CheckoutFactoryWithOutput<TFactory>;

  constructor(
    config: FakeConfiguration,
    cache: Cache,
    context: RequestContext,
    factory: CheckoutFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);

    this.config = config;

    this.generator = new Faker({
      locale: [en, base],
      seed: config.seeds.product,
    });
    this.factory = factory;
  }

  @Reactionary({
    inputSchema: CheckoutMutationInitiateCheckoutSchema,
    outputSchema: CheckoutSchema,
  })
  public override async initiateCheckoutForCart(
    payload: CheckoutMutationInitiateCheckout
  ): Promise<Result<CheckoutFactoryCheckoutOutput<TFactory>>> {
    const checkout = this.composeBaseCheckout(payload.cart.identifier);

    return success(this.factory.parseCheckout(this.context, checkout));
  }

  @Reactionary({
    inputSchema: CheckoutQueryByIdSchema,
    outputSchema: CheckoutSchema,
  })
  public override async getById(
    payload: CheckoutQueryById
  ): Promise<Result<CheckoutFactoryCheckoutOutput<TFactory>, NotFoundError>> {
    const checkout = this.composeBaseCheckout(payload.identifier);

    return success(this.factory.parseCheckout(this.context, checkout));
  }

  @Reactionary({
    inputSchema: CheckoutMutationSetShippingAddressSchema,
    outputSchema: CheckoutSchema,
  })
  public override async setShippingAddress(
    payload: CheckoutMutationSetShippingAddress
  ): Promise<Result<CheckoutFactoryCheckoutOutput<TFactory>>> {
    const checkout = this.composeBaseCheckout(payload.checkout);

    return success(this.factory.parseCheckout(this.context, checkout));
  }

  @Reactionary({
    inputSchema: CheckoutQueryForAvailableShippingMethodsSchema,
    outputSchema: z.array(ShippingMethodSchema),
  })
  public override async getAvailableShippingMethods(
    payload: CheckoutQueryForAvailableShippingMethods
  ): Promise<Result<CheckoutFactoryShippingMethodOutput<TFactory>[]>> {
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

    return success(
      methods.map((method) => this.factory.parseShippingMethod(this.context, method)),
    );
  }

  @Reactionary({
    inputSchema: CheckoutQueryForAvailablePaymentMethodsSchema,
    outputSchema: z.array(PaymentMethodSchema),
  })
  public override async getAvailablePaymentMethods(
    payload: CheckoutQueryForAvailablePaymentMethods
  ): Promise<Result<CheckoutFactoryPaymentMethodOutput<TFactory>[]>> {
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

    return success(
      methods.map((method) => this.factory.parsePaymentMethod(this.context, method)),
    );
  }

  @Reactionary({
    inputSchema: CheckoutMutationAddPaymentInstructionSchema,
    outputSchema: CheckoutSchema,
  })
  public override async addPaymentInstruction(
    payload: CheckoutMutationAddPaymentInstruction
  ): Promise<Result<CheckoutFactoryCheckoutOutput<TFactory>>> {
    const checkout = this.composeBaseCheckout(payload.checkout);

    return success(this.factory.parseCheckout(this.context, checkout));
  }

  @Reactionary({
    inputSchema: CheckoutMutationRemovePaymentInstructionSchema,
    outputSchema: CheckoutSchema,
  })
  public override async removePaymentInstruction(
    payload: CheckoutMutationRemovePaymentInstruction
  ): Promise<Result<CheckoutFactoryCheckoutOutput<TFactory>>> {
    const checkout = this.composeBaseCheckout(payload.checkout);

    return success(this.factory.parseCheckout(this.context, checkout));
  }

  @Reactionary({
    inputSchema: CheckoutMutationSetShippingInstructionSchema,
    outputSchema: CheckoutSchema,
  })
  public override async setShippingInstruction(
    payload: CheckoutMutationSetShippingInstruction
  ): Promise<Result<CheckoutFactoryCheckoutOutput<TFactory>>> {
    const checkout = this.composeBaseCheckout(payload.checkout);

    return success(this.factory.parseCheckout(this.context, checkout));
  }

  @Reactionary({
    inputSchema: CheckoutMutationFinalizeCheckoutSchema,
    outputSchema: CheckoutSchema,
  })
  public override async finalizeCheckout(
    payload: CheckoutMutationFinalizeCheckout
  ): Promise<Result<CheckoutFactoryCheckoutOutput<TFactory>>> {
    const checkout = this.composeBaseCheckout(payload.checkout);

    return success(this.factory.parseCheckout(this.context, checkout));
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
      pointOfContact: {
        email: this.generator.internet.email(),
        phone: this.generator.phone.number(),
      },
    } satisfies Checkout;

    return checkout;
  }
}
