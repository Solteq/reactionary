import type { Cart, MonetaryAmount, Result } from '@reactionary/core';
import * as z from 'zod';

/** The discount extension, as declared in session `capabilities.extensions`. */
export const ACP_DISCOUNT_EXTENSION = {
  name: 'discount',
  extends: [
    '$.CheckoutSessionCreateRequest.discounts',
    '$.CheckoutSessionUpdateRequest.discounts',
    '$.CheckoutSession.discounts',
  ],
};

export const ACPDiscountsRequestSchema = z.object({
  codes: z.array(z.string().min(1)).optional(),
});

export const ACPRejectedDiscountSchema = z.object({
  code: z.string(),
  reason: z.string(),
  message: z.string().optional(),
});

export type ACPRejectedDiscount = z.infer<typeof ACPRejectedDiscountSchema>;

/** The cart operations the discount extension needs. */
export interface ACPDiscountCart {
  applyCouponCode?(payload: unknown): Promise<Result<Cart>>;
  removeCouponCode?(payload: unknown): Promise<Result<Cart>>;
}

/**
 * The codes a request submits: `discounts.codes`, else the deprecated
 * `coupons` alias (discount extension §10.1). Undefined leaves the codes
 * unchanged; an empty list clears them.
 */
export function getRequestedDiscountCodes(
  discounts: z.infer<typeof ACPDiscountsRequestSchema> | undefined,
  coupons: string[] | undefined,
): string[] | undefined {
  return discounts?.codes ?? coupons;
}

/**
 * Applies a submitted code set to the cart with replacement semantics:
 * codes no longer submitted are removed, new ones applied. Codes match
 * case-insensitively; a backend that matches exactly is also tried with the
 * upper-cased code (as in the UCP adapter). The backend does not say why a
 * code was rejected, so rejections are `discount_code_invalid`.
 */
export async function applyDiscountCodes(
  cartCapability: ACPDiscountCart,
  cart: Cart,
  codes: string[],
): Promise<{ cart: Cart; rejected: ACPRejectedDiscount[] }> {
  const { applyCouponCode, removeCouponCode } = cartCapability;

  if (!applyCouponCode || !removeCouponCode) {
    return { cart, rejected: codes.map(rejectedCode) };
  }

  let current = cart;
  const requested = new Set(codes.map((code) => code.toUpperCase()));

  for (const code of getAppliedCodes(current)) {
    if (!requested.has(code.toUpperCase())) {
      const removed = await cartCapability.removeCouponCode?.({ cart: current.identifier, couponCode: code });
      if (removed?.success) {
        current = removed.value;
      }
    }
  }

  const rejected: ACPRejectedDiscount[] = [];
  const seen = new Set<string>();

  for (const code of codes) {
    const normalized = code.toUpperCase();

    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);

    if (getAppliedCodes(current).some((candidate) => candidate.toUpperCase() === normalized)) {
      continue;
    }

    const applied = await applyCode(cartCapability, current, code);
    if (applied) {
      current = applied;
    } else {
      rejected.push(rejectedCode(code));
    }
  }

  return { cart: current, rejected };
}

async function applyCode(cartCapability: ACPDiscountCart, cart: Cart, code: string): Promise<Cart | undefined> {
  for (const candidate of new Set([code, code.toUpperCase()])) {
    const result = await cartCapability.applyCouponCode?.({ cart: cart.identifier, couponCode: candidate });
    if (result?.success) {
      return result.value;
    }
  }

  return undefined;
}

/**
 * The session's `discounts`: submitted codes, the cart's promotions as
 * applied discounts (code-based and automatic), and rejected codes. A sole
 * promotion is attributed the whole discount, allocated to the discounted
 * line items when it is allocated to lines only.
 */
export function toACPDiscounts(
  cart: Cart,
  codes: string[],
  rejected: ACPRejectedDiscount[],
  toMinorUnits: (amount: MonetaryAmount) => number,
): Record<string, unknown> {
  const promotions = cart.appliedPromotions;
  const lineDiscounts = cart.items.map((item) => Math.abs(toMinorUnits(item.price.totalDiscount)));
  const itemsDiscount = lineDiscounts.reduce((sum, amount) => sum + amount, 0);
  const totalDiscount = Math.max(Math.abs(toMinorUnits(cart.price.totalDiscount)), itemsDiscount);
  const soleLineAllocated = promotions.length === 1 && totalDiscount === itemsDiscount && itemsDiscount > 0;

  return {
    codes,
    applied: promotions.map((promotion, index) => {
      const amount = promotion.amount
        ? Math.abs(toMinorUnits(promotion.amount))
        : promotions.length === 1 ? totalDiscount : 0;
      const name = promotion.name || promotion.code || 'Discount';

      return {
        id: `discount_${index + 1}`,
        ...(promotion.isCouponCode && promotion.code ? { code: promotion.code } : {}),
        coupon: {
          id: promotion.code || `promotion_${index + 1}`,
          name,
          amount_off: amount,
          currency: cart.price.grandTotal.currency.toLowerCase(),
        },
        amount,
        automatic: !promotion.isCouponCode,
        ...(soleLineAllocated
          ? {
              method: 'each',
              allocations: lineDiscounts.flatMap((lineAmount, lineIndex) =>
                lineAmount > 0 ? [{ path: `$.line_items[${lineIndex}]`, amount: lineAmount }] : []),
            }
          : {}),
      };
    }),
    rejected,
  };
}

function getAppliedCodes(cart: Cart): string[] {
  return cart.appliedPromotions
    .filter((promotion) => promotion.isCouponCode && promotion.code)
    .map((promotion) => promotion.code);
}

function rejectedCode(code: string): ACPRejectedDiscount {
  return {
    code,
    reason: 'discount_code_invalid',
    message: `Discount code '${code}' could not be applied.`,
  };
}
