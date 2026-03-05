import type {
  Cache,
  CheckoutFactory,
  CheckoutFactoryWithOutput,
  CheckoutProvider,
  ProductFactory,
  ProductFactoryWithOutput,
  ProductProvider,
  RequestContext,
} from "@reactionary/core";
import { CapabilitiesSchema } from "@reactionary/core";
import type { CommercetoolsAPI } from "../core/client.js";
import type { CommercetoolsConfiguration } from "./configuration.schema.js";
import * as z from 'zod';

export const CommercetoolsCapabilitiesSchema = CapabilitiesSchema.pick({
    product: true,
    productSearch: true,
    productAssociations: true,
    productReviews: true,
    productList: true,
    identity: true,
    cart: true,
    checkout: true,
    order: true,
    orderSearch: true,
    inventory: true,
    price: true,
    category: true,
    store: true,
    profile: true
}).extend({
  product: z
    .looseObject({
      enabled: z.boolean(),
      factory: z.any().optional(),
      provider: z.any().optional(),
    })
    .optional(),
  checkout: z
    .looseObject({
      enabled: z.boolean(),
      factory: z.any().optional(),
      provider: z.any().optional(),
    })
    .optional(),
}).partial();

export interface CommercetoolsProductProviderFactoryArgs<
  TFactory extends ProductFactory = ProductFactory,
> {
  cache: Cache;
  context: RequestContext;
  config: CommercetoolsConfiguration;
  commercetoolsApi: CommercetoolsAPI;
  factory: ProductFactoryWithOutput<TFactory>;
}

export interface CommercetoolsProductCapabilityConfig<
  TFactory extends ProductFactory = ProductFactory,
  TProvider extends ProductProvider = ProductProvider,
> {
  factory?: ProductFactoryWithOutput<TFactory>;
  provider?: (args: CommercetoolsProductProviderFactoryArgs<TFactory>) => TProvider;
}

export interface CommercetoolsCheckoutProviderFactoryArgs<
  TFactory extends CheckoutFactory = CheckoutFactory,
> {
  cache: Cache;
  context: RequestContext;
  config: CommercetoolsConfiguration;
  commercetoolsApi: CommercetoolsAPI;
  factory: CheckoutFactoryWithOutput<TFactory>;
}

export interface CommercetoolsCheckoutCapabilityConfig<
  TFactory extends CheckoutFactory = CheckoutFactory,
  TProvider extends CheckoutProvider = CheckoutProvider,
> {
  factory?: CheckoutFactoryWithOutput<TFactory>;
  provider?: (args: CommercetoolsCheckoutProviderFactoryArgs<TFactory>) => TProvider;
}

type CommercetoolsCapabilitiesBase = z.infer<typeof CommercetoolsCapabilitiesSchema>;

export type CommercetoolsCapabilities<
  TProductFactory extends ProductFactory = ProductFactory,
  TProductProvider extends ProductProvider = ProductProvider,
  TCheckoutFactory extends CheckoutFactory = CheckoutFactory,
  TCheckoutProvider extends CheckoutProvider = CheckoutProvider,
> = Omit<CommercetoolsCapabilitiesBase, "product" | "checkout"> & {
  product?: ({ enabled: boolean } & CommercetoolsProductCapabilityConfig<TProductFactory, TProductProvider>);
  checkout?: ({ enabled: boolean } & CommercetoolsCheckoutCapabilityConfig<TCheckoutFactory, TCheckoutProvider>);
};
