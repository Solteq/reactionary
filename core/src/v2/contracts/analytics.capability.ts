import type * as z from 'zod';
import type { AnalyticsMutationSchema } from '../../schemas/index.js';
import type {
  ProviderCapabilityProcedureDefinition,
  ProviderProcedureContext,
  ProcedureContext,
} from '../core/provider-capability-procedure-definition.js';

export type AnalyticsTrackProcedureDefinition<
  Context extends ProviderProcedureContext = ProviderProcedureContext,
> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof AnalyticsMutationSchema,
  z.ZodVoid
>;

export type AnalyticsCapabilityDefinition<
  Context extends ProviderProcedureContext = ProviderProcedureContext,
> = {
  analytics: {
    track: AnalyticsTrackProcedureDefinition<Context>;
  };
};
