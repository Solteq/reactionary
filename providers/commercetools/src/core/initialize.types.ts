import type {
  CheckoutFactory,
  ClientFromCapabilities,
  ProductFactory,
} from '@reactionary/core';
import type {
  CommercetoolsCapabilities,
  CommercetoolsCheckoutCapabilityConfig,
  CommercetoolsProductCapabilityConfig,
} from '../schema/capabilities.schema.js';
import type { CommercetoolsCheckoutFactory } from '../factories/checkout/checkout.factory.js';
import type { CommercetoolsProductFactory } from '../factories/product/product.factory.js';
import type { CommercetoolsCheckoutProvider } from '../providers/checkout.provider.js';
import type { CommercetoolsProductProvider } from '../providers/product.provider.js';

type EnabledCapability<TCapability> =
  TCapability extends { enabled: true } ? true : false;

type NormalizeConfiguredCapabilities<
  T extends CommercetoolsCapabilities,
  TKeys extends keyof T,
> = Omit<T, TKeys> & {
  [K in TKeys]?: EnabledCapability<T[K]>;
};

type ExtractCapabilityFactory<TCapability, TContract, TDefaultFactory> =
  TCapability extends { enabled: true; factory?: infer TFactory }
    ? TFactory extends TContract
      ? TFactory
      : TDefaultFactory
    : TDefaultFactory;

type ExtractCapabilityProvider<TCapability, TDefaultProvider> =
  TCapability extends { enabled: true; provider?: infer TProviderFactory }
    ? TProviderFactory extends (...args: any[]) => infer TProvider
      ? TProvider
      : TDefaultProvider
    : TDefaultProvider;

type CapabilityOverride<
  TCapability,
  TKey extends string,
  TProvider,
> = TCapability extends { enabled: true } ? { [K in TKey]: TProvider } : {};

type NormalizedCapabilities<T extends CommercetoolsCapabilities> =
  NormalizeConfiguredCapabilities<T, 'product' | 'checkout'>;

type ProductFactoryFor<T extends CommercetoolsCapabilities> =
  ExtractCapabilityFactory<T['product'], ProductFactory, CommercetoolsProductFactory>;

type ProductProviderFor<T extends CommercetoolsCapabilities> =
  ExtractCapabilityProvider<
    T['product'],
    CommercetoolsProductProvider<ProductFactoryFor<T>>
  >;

type CheckoutFactoryFor<T extends CommercetoolsCapabilities> =
  ExtractCapabilityFactory<T['checkout'], CheckoutFactory, CommercetoolsCheckoutFactory>;

type CheckoutProviderFor<T extends CommercetoolsCapabilities> =
  ExtractCapabilityProvider<
    T['checkout'],
    CommercetoolsCheckoutProvider<CheckoutFactoryFor<T>>
  >;

export type CommercetoolsClientFromCapabilities<
  T extends CommercetoolsCapabilities,
> = Omit<ClientFromCapabilities<NormalizedCapabilities<T>>, 'product' | 'checkout'> &
  CapabilityOverride<T['product'], 'product', ProductProviderFor<T>> &
  CapabilityOverride<T['checkout'], 'checkout', CheckoutProviderFor<T>>;

export type ProductProviderFactory = NonNullable<
  CommercetoolsProductCapabilityConfig['provider']
>;
export type ProductProviderFactoryArgs = Parameters<ProductProviderFactory>[0];

export type CheckoutProviderFactory = NonNullable<
  CommercetoolsCheckoutCapabilityConfig['provider']
>;
export type CheckoutProviderFactoryArgs = Parameters<CheckoutProviderFactory>[0];

export function resolveCapabilityProvider<TFactory, TProvider, TProviderArgs>(
  capability:
    | {
        factory?: TFactory;
        provider?: (args: TProviderArgs) => TProvider;
      }
    | undefined,
  defaults: {
    factory: TFactory;
    provider: (args: TProviderArgs) => TProvider;
  },
  buildProviderArgs: (factory: TFactory) => TProviderArgs,
): TProvider {
  const factory = capability?.factory ?? defaults.factory;
  const provider = capability?.provider ?? defaults.provider;

  return provider(buildProviderArgs(factory));
}
