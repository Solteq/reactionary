import {
  bindProviderDefinitions,
  createClientFromDefinitions,
  type ProcedureContext,
} from '@reactionary/core';
import {
  GoogleAnalyticsConfigurationSchema,
  type GoogleAnalyticsConfiguration,
} from './configuration.js';
import { googleAnalyticsCapability } from '../capabilities/analytics/analytics-capability.js';

export const googleAnalyticsCapabilities = {
  ...googleAnalyticsCapability,
};

type SelectionFor<P extends object> = Partial<Record<keyof P, boolean>>;
export type GoogleAnalyticsCapabilitySelection = SelectionFor<
  typeof googleAnalyticsCapabilities
>;
type NoExtraKeys<T, Shape> = T & Record<Exclude<keyof T, keyof Shape>, never>;

type PickSelected<P extends object, S extends SelectionFor<P>> = {
  [K in keyof P as K extends keyof S
    ? S[K] extends true
      ? K
      : never
    : never]: P[K];
};

function pickCapabilities<
  const P extends Record<string, unknown>,
  const S extends SelectionFor<P>,
>(providers: P, selection: S): PickSelected<P, S> {
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
  const S extends GoogleAnalyticsCapabilitySelection | undefined = undefined,
>(
  configuration: GoogleAnalyticsConfiguration,
  selection?: GoogleAnalyticsCapabilitySelection &
    (S extends undefined
      ? undefined
      : NoExtraKeys<S, GoogleAnalyticsCapabilitySelection>),
) {
  const config = GoogleAnalyticsConfigurationSchema.parse(configuration);
  const selectedCapabilities = selection
    ? pickCapabilities(googleAnalyticsCapabilities, selection)
    : googleAnalyticsCapabilities;

  return function withContext(context: ProcedureContext) {
    const providerContext = {
      config,
    };

    const definitions = bindProviderDefinitions(selectedCapabilities, providerContext);
    return createClientFromDefinitions(definitions, context);
  };
}

export const googleAnalyticsCapabilitiesInitializer = initialize;
