import type { Cart as CTCart } from "@commercetools/platform-sdk";
import {
  CheckoutSchema,
  PaymentMethodSchema,
  ShippingMethodSchema,
  type CheckoutQueryById,
  type RequestContext,
  unwrapValue,
} from "@reactionary/core";
import { withCommercetoolsCapabilities } from "../../core/initialize.js";
import { CommercetoolsCheckoutCapability } from "../../capabilities/checkout.capability.js";
import { assertNotAny, assertType } from "../product/utils.example.js";
import { CommercetoolsCheckoutFactory } from "./checkout.factory.js";
import * as z from "zod";

const cache = {} as any;
const context = {} as any;
const config = {} as any;

const ExtendedCheckoutSchema = CheckoutSchema.safeExtend({
  extendedValue: z.string().default(""),
});

type ExtendedCheckout = z.output<typeof ExtendedCheckoutSchema>;

class ExtendedCommercetoolsCheckoutFactory extends CommercetoolsCheckoutFactory<
  typeof ExtendedCheckoutSchema,
  typeof ShippingMethodSchema,
  typeof PaymentMethodSchema
> {
  constructor() {
    super(ExtendedCheckoutSchema, ShippingMethodSchema, PaymentMethodSchema);
  }

  public override parseCheckout(
    context: RequestContext,
    data: CTCart,
  ): ExtendedCheckout {
    const base = super.parseCheckout(context, data);
    return {
      ...base,
      extendedValue: "from-factory",
    };
  }
}

class ExtendedCommercetoolsCheckoutCapability extends CommercetoolsCheckoutCapability<ExtendedCommercetoolsCheckoutFactory> {
  public async getByIdOrThrow(payload: CheckoutQueryById): Promise<ExtendedCheckout> {
    const result = await this.getById(payload);
    return unwrapValue(result);
  }
}

const extendedFactory = new ExtendedCommercetoolsCheckoutFactory();

const capabilityFactory = withCommercetoolsCapabilities(config, {
  checkout: {
    enabled: true,
    factory: extendedFactory,
    capability: ({ cache, context, config, commercetoolsApi }) =>
      new ExtendedCommercetoolsCheckoutCapability(
        config,
        cache,
        context,
        commercetoolsApi,
        extendedFactory,
      ),
  },
});

const client = capabilityFactory(cache, context);

client.checkout
  .getById({
    identifier: { key: "checkout-1" },
  })
  .then((result) => {
    assertNotAny(result);
    if (result.success) {
      assertNotAny(result.value);
      assertNotAny(result.value.extendedValue);
      assertType<string>(result.value.extendedValue);
    }
  });

client.checkout
  .getByIdOrThrow({
    identifier: { key: "checkout-2" },
  })
  .then((checkout) => {
    assertNotAny(checkout);
    assertNotAny(checkout.extendedValue);
    assertType<string>(checkout.extendedValue);
  });
