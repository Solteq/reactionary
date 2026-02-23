import type * as z from 'zod';
import { error, type Result } from '../../schemas/result.js';

export type CapabilityProcedureDefiniton<Ctx, In extends z.ZodTypeAny, Out extends z.ZodTypeAny, Data = any> = {
  inputSchema: In;
  outputSchema: Out;
  fetch: (input: z.infer<In>, ctx: Ctx) => Promise<Result<Data>>;
  transform: (input: z.infer<In>, ctx: Ctx, data: Data) => Promise<Result<z.infer<Out>>>;
};

export type CapabilityProcedure<In extends z.ZodTypeAny, Out extends z.ZodTypeAny> = {
  execute: (input: z.infer<In>) => Promise<Result<z.infer<Out>>>;
};

export function bindProcedure<Ctx, In extends z.ZodTypeAny, Out extends z.ZodTypeAny>(
  def: CapabilityProcedureDefiniton<Ctx, In, Out>,
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

        const result = await def.transform(input, ctx, data);

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
