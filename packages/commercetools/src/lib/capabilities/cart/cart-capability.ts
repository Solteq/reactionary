import type { CartCapabilityDefinition } from '@reactionary/core';
import { commercetoolsCartAdd } from './cart-add.js';
import { commercetoolsCartActiveCartId } from './cart-active-cart-id.js';
import { commercetoolsCartById } from './cart-by-id.js';
import { commercetoolsCartApplyCouponCode } from './cart-apply-coupon-code.js';
import { commercetoolsCartChangeCurrency } from './cart-change-currency.js';
import { commercetoolsCartChangeQuantity } from './cart-change-quantity.js';
import { commercetoolsCartDelete } from './cart-delete.js';
import { commercetoolsCartRemove } from './cart-remove.js';
import { commercetoolsCartRemoveCouponCode } from './cart-remove-coupon-code.js';
import type { CommercetoolsProcedureContext } from '../../core/context.js';

export const commercetoolsCartCapability = {
  cart: {
    byId: commercetoolsCartById,
    activeCartId: commercetoolsCartActiveCartId,
    add: commercetoolsCartAdd,
    remove: commercetoolsCartRemove,
    changeQuantity: commercetoolsCartChangeQuantity,
    delete: commercetoolsCartDelete,
    applyCouponCode: commercetoolsCartApplyCouponCode,
    removeCouponCode: commercetoolsCartRemoveCouponCode,
    changeCurrency: commercetoolsCartChangeCurrency,
  },
} satisfies CartCapabilityDefinition<CommercetoolsProcedureContext>;
