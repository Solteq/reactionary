import { makeInitializer, mergeDefsFor, type ProcedureContext, type RequestContext } from "@reactionary/core";
import type { CommercetoolsProcedureContext } from "./context.js";
import { commercetoolsProductCapability } from "../capabilities/product/product-capability.js";

const merge = mergeDefsFor<ProcedureContext>();

export const commercetoolsCapabilities = merge(commercetoolsProductCapability);
export const commercetoolsCapabilitiesInitializer = makeInitializer(commercetoolsCapabilities);
