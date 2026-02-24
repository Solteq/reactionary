import type * as z from 'zod';
import type {
  CartIdentifierSchema,
  CartMutationApplyCouponSchema,
  CartMutationChangeCurrencySchema,
  CartMutationDeleteCartSchema,
  CartMutationItemAddSchema,
  CartMutationItemQuantityChangeSchema,
  CartMutationItemRemoveSchema,
  CartMutationRemoveCouponSchema,
  CartQueryByIdSchema,
  CartSchema,
} from '../../schemas/index.js';
import type { ProviderProcedureContext, ProviderCapabilityProcedureDefinition, ProcedureContext } from '../core/provider-capability-procedure-definition.js';

type VoidSchema = z.ZodVoid;

export type CartByIdProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof CartQueryByIdSchema,
  typeof CartSchema
>;
export type CartItemAddProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof CartMutationItemAddSchema,
  typeof CartSchema
>;
export type CartItemRemoveProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof CartMutationItemRemoveSchema,
  typeof CartSchema
>;
export type CartItemChangeQuantityProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof CartMutationItemQuantityChangeSchema,
  typeof CartSchema
>;
export type CartDeleteProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof CartMutationDeleteCartSchema,
  VoidSchema
>;
export type CartApplyCouponProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof CartMutationApplyCouponSchema,
  typeof CartSchema
>;
export type CartRemoveCouponProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof CartMutationRemoveCouponSchema,
  typeof CartSchema
>;
export type CartChangeCurrencyProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof CartMutationChangeCurrencySchema,
  typeof CartSchema
>;
export type CartActiveCartIdProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  z.ZodVoid,
  typeof CartIdentifierSchema
>;

export type CartCapabilityDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = {
  cart: {
    byId: CartByIdProcedureDefinition<Context>;
    activeCartId: CartActiveCartIdProcedureDefinition<Context>;
    add: CartItemAddProcedureDefinition<Context>;
    remove: CartItemRemoveProcedureDefinition<Context>;
    changeQuantity: CartItemChangeQuantityProcedureDefinition<Context>;
    delete: CartDeleteProcedureDefinition<Context>;
    applyCouponCode: CartApplyCouponProcedureDefinition<Context>;
    removeCouponCode: CartRemoveCouponProcedureDefinition<Context>;
    changeCurrency: CartChangeCurrencyProcedureDefinition<Context>;
  };
};
