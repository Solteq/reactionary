import {
  type CapabilityProcedureDefinition,
} from './capability-procedure-definition.js';
import type { ProcedureContext, ProviderProcedureContext, ProviderCapabilityProcedureDefinition } from './provider-capability-procedure-definition.js';

export type ProviderClientDefinition<ProviderContext extends ProviderProcedureContext, Context extends ProcedureContext> = Record<
  string,
  Record<string, ProviderCapabilityProcedureDefinition<ProviderContext, Context, any, any, any>>
>;

type CapabilityDefsFromProviderDefs<
  Ctx extends ProcedureContext,
  Defs extends ProviderClientDefinition<any, Ctx>
> = {
  [Cap in keyof Defs]: {
    [Proc in keyof Defs[Cap]]: Defs[Cap][Proc] extends ProviderCapabilityProcedureDefinition<any, Ctx, infer In, infer Out, infer Data>
      ? CapabilityProcedureDefinition<Ctx, In, Out, Data>
      : never;
  };
};

export function bindProviderDefinitions<
  ProviderContext extends ProviderProcedureContext,
  Ctx extends ProcedureContext,
  const Defs extends ProviderClientDefinition<ProviderContext, Ctx>
>(
  defs: Defs,
  providerContext: ProviderContext
): CapabilityDefsFromProviderDefs<Ctx, Defs> {
  const out: any = {};

  for (const capName of Object.keys(defs)) {
    const capDefs = defs[capName];
    out[capName] = {};

    for (const procName of Object.keys(capDefs)) {
      const procDef = capDefs[procName];
      out[capName][procName] = {
        inputSchema: procDef.inputSchema,
        outputSchema: procDef.outputSchema,
        fetch: (input: any, ctx: Ctx) => procDef.fetch(input, ctx, providerContext),
        transform: (input: any, ctx: Ctx, data: any) => procDef.transform(input, ctx, data, providerContext),
      };
    }
  }

  return out as CapabilityDefsFromProviderDefs<Ctx, Defs>;
}
