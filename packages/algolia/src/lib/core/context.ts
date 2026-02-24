import { providerProcedure, type ProcedureContext } from '@reactionary/core';
import type { AlgoliaConfiguration } from './configuration.js';

export type AlgoliaProcedureContext = {
  config: AlgoliaConfiguration;
};

export const algoliaProcedure = providerProcedure<AlgoliaProcedureContext, ProcedureContext>();
