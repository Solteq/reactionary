import type * as z from 'zod';
import type { Result } from '../../schemas/result.js';
import type { RequestContext } from '../../schemas/session.schema.js';

/**
 * This is the context that is provided to individual procedures within a provider scope.
 * While we make no restrictions on it as a base, it exists to provide a closure for
 * configuration scoped to an individual provider - typically clients and configurations.
 */
export type ProviderProcedureContext = object;

/**
 * This is the global context that is provided across all providers at the time of constructing
 * the final client. It contains the elements that are truly global.
 */
export type ProcedureContext = {
  request: RequestContext
}

/**
 * This is the innermost, most atomic level of a procedure, as defined and seen within the provider
 * itself. As such it forwards both the global context (ProcedureContext) and the provider-scoped
 * context (ProviderProcedureContext)
 */
export type ProviderCapabilityProcedureDefinition<ProviderContext extends ProviderProcedureContext, Ctx extends ProcedureContext, In extends z.ZodTypeAny, Out extends z.ZodTypeAny, Data = any> = {
  inputSchema: In;
  outputSchema: Out;
  fetch: (input: z.infer<In>, ctx: Ctx, providerContext: ProviderContext) => Promise<Result<Data>>;
  transform: (input: z.infer<In>, ctx: Ctx, data: Data, providerContext: ProviderContext) => Promise<Result<z.infer<Out>>>;
};

/**
 * Utility function to lock in the generics of a procedure within a given scope, to avoid having to repeat
 * it everywhere.
 */
export const providerProcedure =
  <ProviderContext extends ProviderProcedureContext, Ctx extends ProcedureContext>() =>
  <In extends z.ZodTypeAny, Out extends z.ZodTypeAny, TData = unknown>(
    def: ProviderCapabilityProcedureDefinition<ProviderContext, Ctx, In, Out, TData>,
  ) =>
    def;
