import { providerProcedure, type ProcedureContext } from '@reactionary/core';
import type { GoogleAnalyticsConfiguration } from './configuration.js';

export type GoogleAnalyticsProcedureContext = {
  config: GoogleAnalyticsConfiguration;
};

export const googleAnalyticsProcedure = providerProcedure<
  GoogleAnalyticsProcedureContext,
  ProcedureContext
>();
