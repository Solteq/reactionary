import type * as z from 'zod';
import { type Result } from '../../schemas/result.js';
import type { ProcedureContext } from './provider-capability-procedure-definition.js';

/**
 * This is the definition of a capable, as seen after it has been wrapped up in a provider scope. At this point the provider-specific
 * context is already baked in.
 */
export type CapabilityProcedureDefinition<Ctx extends ProcedureContext, In extends z.ZodTypeAny, Out extends z.ZodTypeAny, Data = any> = {
  inputSchema: In;
  outputSchema: Out;
  fetch: (input: z.infer<In>, ctx: Ctx) => Promise<Result<Data>>;
  transform: (input: z.infer<In>, ctx: Ctx, data: Data) => Promise<Result<z.infer<Out>>>;
};

/**
 * Utility function to lock in the generics of a procedure within a given scope, to avoid having to repeat
 * it everywhere.
 */
export const procedure =
  <Ctx extends ProcedureContext>() =>
  <In extends z.ZodTypeAny, Out extends z.ZodTypeAny, TData = unknown>(
    def: CapabilityProcedureDefinition<Ctx, In, Out, TData>,
  ) =>
    def;
