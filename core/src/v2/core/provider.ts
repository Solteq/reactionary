import { type CapabilityProcedureDefiniton } from './capability-procedure.js';
import { mergeDefs, type ClientDefinition } from './client.js';
import type * as z from 'zod';

export const procedure =
  <Ctx>() =>
  <In extends z.ZodTypeAny, Out extends z.ZodTypeAny, TData = unknown>(
    def: CapabilityProcedureDefiniton<Ctx, In, Out, TData>,
  ) =>
    def;

export const mergeDefsFor =
  <Ctx>() =>
  <const Providers extends readonly ClientDefinition<Ctx>[]>(
    ...providers: Providers
  ) =>
    mergeDefs<Ctx, Providers>(...providers);
