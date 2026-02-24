import { providerProcedure, type ProcedureContext } from '@reactionary/core';
import type { CommercetoolsAPI, CommercetoolsConfiguration } from '@reactionary/provider-commercetools';

export type CommercetoolsProcedureContext = {
    client: CommercetoolsAPI,
    config: CommercetoolsConfiguration
}
export const commercetoolsProcedure = providerProcedure<CommercetoolsProcedureContext, ProcedureContext>();