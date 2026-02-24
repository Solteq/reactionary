import type {
  CustomerPriceQuerySchema,
  ListPriceQuerySchema,
  PriceSchema,
} from '../../schemas/index.js';
import type { ProviderProcedureContext, ProviderCapabilityProcedureDefinition, ProcedureContext } from '../core/provider-capability-procedure-definition.js';

export type PriceListPriceProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof ListPriceQuerySchema,
  typeof PriceSchema
>;

export type PriceCustomerPriceProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof CustomerPriceQuerySchema,
  typeof PriceSchema
>;

export type PriceCapabilityDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = {
  price: {
    listPrice: PriceListPriceProcedureDefinition<Context>;
    customerPrice: PriceCustomerPriceProcedureDefinition<Context>;
  };
};
