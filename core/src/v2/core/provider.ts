import {
  type CapabilityProcedureDefiniton,
  type ProcedureContext,
  type ProviderCapabilityProcedureDefiniton,
  type ProviderProcedureContext,
} from './capability-procedure.js';
import { mergeDefs, type ClientDefinition } from './client.js';
import type * as z from 'zod';

export const procedure =
  <Ctx extends ProcedureContext>() =>
  <In extends z.ZodTypeAny, Out extends z.ZodTypeAny, TData = unknown>(
    def: CapabilityProcedureDefiniton<Ctx, In, Out, TData>,
  ) =>
    def;

export const providerProcedure =
  <ProviderContext extends ProviderProcedureContext, Ctx extends ProcedureContext>() =>
  <In extends z.ZodTypeAny, Out extends z.ZodTypeAny, TData = unknown>(
    def: ProviderCapabilityProcedureDefiniton<ProviderContext, Ctx, In, Out, TData>,
  ) =>
    def;

export const mergeDefsFor =
  <Ctx extends ProcedureContext>() =>
  <const Providers extends readonly ClientDefinition<Ctx>[]>(
    ...providers: Providers
  ) =>
    mergeDefs<Ctx, Providers>(...providers);