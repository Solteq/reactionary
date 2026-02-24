import type * as z from 'zod';
import type { CapabilityProcedureDefinition } from './capability-procedure-definition.js';
import { type CapabilityProcedure, bindProcedure } from './capability-procedure.js';
import type { ProcedureContext } from './provider-capability-procedure-definition.js';

export type ClientDefinition<Context extends ProcedureContext> = Record<
  string,
  Record<string, CapabilityProcedureDefinition<Context, z.ZodTypeAny, z.ZodTypeAny>>
>;

export type ClientFromDefinition<Ctx extends ProcedureContext, Defs extends ClientDefinition<Ctx>> = {
  [Cap in keyof Defs]: {
    [Proc in keyof Defs[Cap]]: CapabilityProcedure<
      Defs[Cap][Proc]["inputSchema"],
      Defs[Cap][Proc]["outputSchema"]
    >;
  };
};

export function createClientFromDefinitions<Ctx extends ProcedureContext, Defs extends ClientDefinition<Ctx>>(
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
type MergeObjects<A, B> = Omit<A, keyof B> & B;

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

type MergeManyObjects<Arr extends readonly any[], Acc = object> =
  Arr extends readonly [infer H, ...infer T]
    ? MergeManyObjects<T, MergeObjects<Acc, H>>
    : Acc;

type FactoryReturns<Factories extends readonly ((...args: any[]) => any)[]> = {
  [K in keyof Factories]: ReturnType<Factories[K]>;
};


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

export type InitializedClientFactory<Ctx extends ProcedureContext, Client extends object> = (context: Ctx) => Client;

export function createClient<
  Ctx extends ProcedureContext,
  const Factories extends readonly InitializedClientFactory<Ctx, object>[]
>(
  context: Ctx,
  ...factories: Factories
): MergeManyObjects<FactoryReturns<Factories>> {
  const out: object = {};

  for (const factory of factories) {
    Object.assign(out, factory(context));
  }

  return out as MergeManyObjects<FactoryReturns<Factories>>;
}
