import { bindProviderDefinitions, createClientFromDefinitions, type ProcedureContext } from "@reactionary/core";
import { CommercetoolsAPI, CommercetoolsConfigurationSchema, type CommercetoolsConfiguration } from "@reactionary/provider-commercetools";
import { commercetoolsCartCapability } from "../capabilities/cart/cart-capability.js";
import { commercetoolsCategoryCapability } from "../capabilities/category/category-capability.js";
import { commercetoolsIdentityCapability } from "../capabilities/identity/identity-capability.js";
import { commercetoolsInventoryCapability } from "../capabilities/inventory/inventory-capability.js";
import { commercetoolsCheckoutCapability } from "../capabilities/checkout/checkout-capability.js";
import { commercetoolsOrderSearchCapability } from "../capabilities/order-search/order-search-capability.js";
import { commercetoolsOrderCapability } from "../capabilities/order/order-capability.js";
import { commercetoolsPriceCapability } from "../capabilities/price/price-capability.js";
import { commercetoolsProductSearchCapability } from "../capabilities/product-search/product-search-capability.js";
import { commercetoolsProductCapability } from "../capabilities/product/product-capability.js";
import { commercetoolsProfileCapability } from "../capabilities/profile/profile-capability.js";
import { commercetoolsStoreCapability } from "../capabilities/store/store-capability.js";

export const commercetoolsCapabilities = {
  ...commercetoolsProductCapability,
  ...commercetoolsCartCapability,
  ...commercetoolsCategoryCapability,
  ...commercetoolsCheckoutCapability,
  ...commercetoolsIdentityCapability,
  ...commercetoolsInventoryCapability,
  ...commercetoolsProductSearchCapability,
  ...commercetoolsProfileCapability,
  ...commercetoolsPriceCapability,
  ...commercetoolsOrderCapability,
  ...commercetoolsOrderSearchCapability,
  ...commercetoolsStoreCapability,
};

type SelectionFor<P extends object> = Partial<Record<keyof P, boolean>>;
export type CommercetoolsCapabilitySelection = SelectionFor<typeof commercetoolsCapabilities>;
type NoExtraKeys<T, Shape> = T & Record<Exclude<keyof T, keyof Shape>, never>;

type PickSelected<P extends object, S extends SelectionFor<P>> = {
  [K in keyof P as K extends keyof S
    ? S[K] extends true
      ? K
      : never
    : never]: P[K]
};

function pickCapabilities<const P extends Record<string, unknown>, const S extends SelectionFor<P>>(providers: P, selection: S): PickSelected<P, S> {
  const result: Partial<P> = {};

  for (const key in selection) {
    if (selection[key]) {
      const k = key as keyof P;
      result[k] = providers[k];
    }
  }

  return result as unknown as PickSelected<P, S>;
}

export function initialize<
  const S extends CommercetoolsCapabilitySelection | undefined = undefined,
>(
  configuration: CommercetoolsConfiguration,
  selection?: CommercetoolsCapabilitySelection &
    (S extends undefined ? undefined : NoExtraKeys<S, CommercetoolsCapabilitySelection>),
) {
  const config = CommercetoolsConfigurationSchema.parse(configuration);
  const selectedCapabilities = selection
    ? pickCapabilities(commercetoolsCapabilities, selection)
    : commercetoolsCapabilities;

  return function withContext(context: ProcedureContext) {
    const providerContext = {
      config,
      client: new CommercetoolsAPI(config, context.request),
    };

    const definitions = bindProviderDefinitions(selectedCapabilities, providerContext);

    return createClientFromDefinitions(definitions, context);
  };
}

export const commercetoolsCapabilitiesInitializer = initialize;
