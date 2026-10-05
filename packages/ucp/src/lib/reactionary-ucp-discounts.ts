import type { Cart } from '@reactionary/core';
import * as z from 'zod';
import type { ReactionaryUCPClient } from './reactionary-ucp-common.js';
import {
  createUcpWarning,
  getLineDiscount,
  getMoneyValue,
  type UCPMessage,
} from './reactionary-ucp-mapping.js';

// The discount extension is not part of the generated base schema.
const DiscountsRequestSchema = z.looseObject({
  codes: z.array(z.string()).optional(),
});

/** The discount codes a request submits, if it submits any (`[]` clears them). */
export function getRequestedDiscountCodes(body: Record<string, unknown>): string[] | undefined {
  const discounts = DiscountsRequestSchema.safeParse(body['discounts']);

  return discounts.success ? discounts.data.codes : undefined;
}

/**
 * Applies a submitted code set to the cart with replacement semantics: codes
 * no longer submitted are removed, new ones are applied. Codes match
 * case-insensitively; a backend that matches exactly is also tried with the
 * upper-cased code. Rejected codes are reported as warnings.
 */
export async function applyDiscountCodes(
  client: ReactionaryUCPClient,
  cart: Cart,
  codes: string[],
): Promise<{ cart: Cart; messages: UCPMessage[] }> {
  const cartCapability = client.cart;
  const messages: UCPMessage[] = [];
  let current = cart;

  if (!cartCapability?.applyCouponCode || !cartCapability.removeCouponCode) {
    return { cart, messages: codes.map((code, index) => rejectedCode(code, index)) };
  }

  const requested = new Set(codes.map((code) => code.toUpperCase()));
  for (const code of getAppliedCodes(current)) {
    if (!requested.has(code.toUpperCase())) {
      const removed = await cartCapability.removeCouponCode({ cart: current.identifier, couponCode: code });
      if (removed.success) {
        current = removed.value;
      }
    }
  }

  const seen = new Set<string>();
  for (const [index, code] of codes.entries()) {
    const normalized = code.toUpperCase();
    const applied = getAppliedCodes(current).some((candidate) => candidate.toUpperCase() === normalized);

    if (seen.has(normalized) || applied) {
      seen.add(normalized);
      continue;
    }
    seen.add(normalized);

    const result = await applyCode(cartCapability, current, code);
    if (result) {
      current = result;
    } else {
      messages.push(rejectedCode(code, index));
    }
  }

  return { cart: current, messages };
}

async function applyCode(
  cartCapability: NonNullable<ReactionaryUCPClient['cart']>,
  cart: Cart,
  code: string,
): Promise<Cart | undefined> {
  for (const candidate of new Set([code, code.toUpperCase()])) {
    const result = await cartCapability.applyCouponCode?.({ cart: cart.identifier, couponCode: candidate });
    if (result?.success) {
      return result.value;
    }
  }

  return undefined;
}

/**
 * The discount extension's view of the cart's promotions. Amounts come from
 * the promotion when the backend reports them; otherwise a sole promotion is
 * attributed the cart's whole discount, with per-line allocations when it is
 * allocated to lines only.
 */
export function toUcpDiscounts(cart: Cart): { discounts: Record<string, unknown> } {
  const promotions = cart.appliedPromotions;
  const lineDiscounts = cart.items.map(getLineDiscount);
  const itemsDiscount = lineDiscounts.reduce((sum, amount) => sum + amount, 0);
  const totalDiscount = Math.max(Math.abs(getMoneyValue(cart.price.totalDiscount)), itemsDiscount);
  const soleLineAllocated = promotions.length === 1 && totalDiscount === itemsDiscount && itemsDiscount > 0;

  return {
    discounts: {
      codes: getAppliedCodes(cart),
      applied: promotions.map((promotion) => ({
        ...(promotion.isCouponCode ? { code: promotion.code } : {}),
        title: promotion.name || promotion.code || 'Discount',
        amount: promotion.amount
          ? Math.abs(getMoneyValue(promotion.amount))
          : promotions.length === 1 ? totalDiscount : 0,
        automatic: !promotion.isCouponCode,
        ...(soleLineAllocated
          ? {
            allocations: lineDiscounts.flatMap((amount, index) =>
              amount > 0 ? [{ path: `$.line_items[${index}]`, amount }] : []),
          }
          : {}),
      })),
    },
  };
}

function getAppliedCodes(cart: Cart): string[] {
  return cart.appliedPromotions
    .filter((promotion) => promotion.isCouponCode && promotion.code)
    .map((promotion) => promotion.code);
}

function rejectedCode(code: string, index: number): UCPMessage {
  // The backend does not say why a code was rejected.
  return createUcpWarning('discount_code_invalid', `Discount code '${code}' could not be applied.`, `$.discounts.codes[${index}]`);
}
