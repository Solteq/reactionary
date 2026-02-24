import type * as z from 'zod';
import { error, type Result } from '../../schemas/result.js';
import type { CapabilityProcedureDefinition } from './capability-procedure-definition.js';
import type { ProcedureContext } from './provider-capability-procedure-definition.js';

/**
 * The final shape of a procedure within a capability, as presented to the calling / consuming party.
 */
export type CapabilityProcedure<In extends z.ZodTypeAny, Out extends z.ZodTypeAny> = {
  execute: (input: z.infer<In>) => Promise<Result<z.infer<Out>>>;
};

/**
 * Utility function for turning the internal shape of a procedure into the external shape of a procedure. That
 * is, the transformation from CapabilityProcedureDefinition -> CapabilityProcedure. This involves adding global
 * middleware such as telemetry, error handling and input / output validation.
 */
export function bindProcedure<Ctx extends ProcedureContext, In extends z.ZodTypeAny, Out extends z.ZodTypeAny>(
  def: CapabilityProcedureDefinition<Ctx, In, Out>,
  ctx: Ctx
): CapabilityProcedure<In, Out> {
  return {
    async execute(input) {
      try {
        // const parsedIn = def.inputSchema.parse(input);

        const data = await def.fetch(input, ctx);

        if (!data.success) {
          return data;
        }

        const result = await def.transform(input, ctx, data.value);

        // const parsedOut = def.outputSchema.parse(out);

        return result;
      } catch (e) {
        return error({
            type: 'Foo'
        });
      }
    },
  };
}
