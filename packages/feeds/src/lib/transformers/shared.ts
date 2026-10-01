import type {
  ReactionaryFeedMoney,
  ReactionaryFeedProduct,
  ReactionaryFeedVariant,
} from '../feed-types.js';

export function toMinorUnits(value: number): number {
  return Math.max(Math.round(value * 100), 0);
}

export function formatMoney(
  money: ReactionaryFeedMoney | undefined,
): string | undefined {
  if (!money) {
    return undefined;
  }

  return `${money.value.toFixed(2)} ${money.currency.toUpperCase()}`;
}

export function googleMoney(
  money: ReactionaryFeedMoney | undefined,
): string | undefined {
  return formatMoney(money);
}

export function primaryImage(
  product: ReactionaryFeedProduct,
  variant?: ReactionaryFeedVariant,
): string | undefined {
  return variant?.images[0]?.url ?? product.images[0]?.url;
}

export function productDescription(product: ReactionaryFeedProduct): string {
  return product.description ?? product.title;
}
