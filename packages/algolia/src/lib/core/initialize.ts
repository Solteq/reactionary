import { bindProviderDefinitions, createClientFromDefinitions, type ProcedureContext } from '@reactionary/core';
import {
  AlgoliaConfigurationSchema,
  type AlgoliaConfiguration,
} from './configuration.js';
import { algoliaProductSearchCapability } from '../capabilities/product-search/product-search-capability.js';

export const algoliaCapabilities = {
  ...algoliaProductSearchCapability,
};

type SelectionFor<P extends object> = Partial<Record<keyof P, boolean>>;

type PickSelected<P extends object, S extends SelectionFor<P>> = {
  [K in keyof P as K extends keyof S
    ? S[K] extends true
      ? K
      : never
    : never]: P[K]
};

function pickCapabilities<const P extends Record<string, unknown>, const S extends SelectionFor<P>>(
  providers: P,
  selection: S,
): PickSelected<P, S> {
  const result: Partial<P> = {};

  for (const key in selection) {
    if (selection[key]) {
      const k = key as keyof P;
      result[k] = providers[k];
    }
  }

  return result as unknown as PickSelected<P, S>;
}

export function initialize<
  const S extends SelectionFor<typeof algoliaCapabilities> | undefined = undefined,
>(configuration: AlgoliaConfiguration, selection?: S) {
  const config = AlgoliaConfigurationSchema.parse(configuration);
  const selectedCapabilities = selection
    ? pickCapabilities(algoliaCapabilities, selection)
    : algoliaCapabilities;

  return function withContext(context: ProcedureContext) {
    const providerContext = {
      config,
    };

    const definitions = bindProviderDefinitions(selectedCapabilities, providerContext);
    return createClientFromDefinitions(definitions, context);
  };
}

export const algoliaCapabilitiesInitializer = initialize;
