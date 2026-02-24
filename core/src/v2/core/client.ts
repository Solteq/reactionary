import type * as z from 'zod';
import { bindProcedure, type CapabilityProcedure, type CapabilityProcedureDefiniton, type ProcedureContext } from "./capability-procedure.js";

export type ClientDefinition<Context extends ProcedureContext> = Record<
  string,
  Record<string, CapabilityProcedureDefiniton<Context, z.ZodTypeAny, z.ZodTypeAny>>
>;

export type ClientFromDefinition<Ctx extends ProcedureContext, Defs extends ClientDefinition<Ctx>> = {
  [Cap in keyof Defs]: {
    [Proc in keyof Defs[Cap]]: CapabilityProcedure<
      Defs[Cap][Proc]["inputSchema"],
      Defs[Cap][Proc]["outputSchema"]
    >;
  };
};

export function createClient<Ctx extends ProcedureContext, Defs extends ClientDefinition<Ctx>>(
  defs: Defs,
  ctx: Ctx
): ClientFromDefinition<Ctx, Defs> {
  const client: any = {};

  for (const capName of Object.keys(defs)) {
    const capDefs = defs[capName];
    const capClient: any = {};

    for (const procName of Object.keys(capDefs)) {
      capClient[procName] = bindProcedure(capDefs[procName], ctx);
    }

    client[capName] = capClient;
  }

  return client;
}

type MergeProcs<A, B> = Omit<A, keyof B> & B;

type MergeCaps<A, B> = {
  [K in keyof A | keyof B]:
    K extends keyof B
      ? K extends keyof A
        ? MergeProcs<A[K], B[K]>
        : B[K]
      : K extends keyof A
        ? A[K]
        : never;
};

type MergeMany<Arr extends readonly any[], Acc = object> =
  Arr extends readonly [infer H, ...infer T]
    ? MergeMany<T, MergeCaps<Acc, H>>
    : Acc;


export function mergeDefs<
  Ctx extends ProcedureContext,
  const Providers extends readonly ClientDefinition<Ctx>[]
>(...providers: Providers): MergeMany<Providers> {
  const out: any = {};

  for (const defs of providers) {
    for (const capName of Object.keys(defs)) {
      const cap = defs[capName];
      out[capName] = {
        ...(out[capName] ?? {}),
        ...cap,
      };
    }
  }

  return out as MergeMany<Providers>;
}