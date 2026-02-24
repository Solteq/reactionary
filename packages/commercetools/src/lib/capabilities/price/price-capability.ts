import type { PriceCapabilityDefinition } from '@reactionary/core';
import type { CommercetoolsProcedureContext } from '../../core/context.js';
import { commercetoolsPriceCustomerPrice } from './price-customer-price.js';
import { commercetoolsPriceListPrice } from './price-list-price.js';

export const commercetoolsPriceCapability = {
  price: {
    listPrice: commercetoolsPriceListPrice,
    customerPrice: commercetoolsPriceCustomerPrice,
  },
} satisfies PriceCapabilityDefinition<CommercetoolsProcedureContext>;
