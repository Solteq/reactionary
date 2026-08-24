import type { MagentoProductReview } from '../schema/magento.types.js';

/**
 * Magento expresses ratings as a percentage (0-100) — `rating_summary` on the
 * product and `average_rating` on the individual review — while reactionary
 * normalizes everything onto a 0-5 star scale.
 */
export function ratingPercentToStars(
  percent: number | null | undefined,
): number {
  if (percent === null || percent === undefined || Number.isNaN(percent)) {
    return 0;
  }
  const stars = (percent / 100) * 5;
  // Two decimals is enough to round-trip every whole-star percentage Magento emits.
  return Math.min(5, Math.max(0, Math.round(stars * 100) / 100));
}

/**
 * Magento emits timestamps as MySQL datetimes in UTC ("2024-05-04 12:00:00"),
 * whereas the reactionary models expose ISO8601. Unparseable values are passed
 * through rather than replaced with a fabricated date.
 */
export function toIsoTimestamp(value: string): string {
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

/**
 * A djb2 hash, purely to keep the derived review key short and stable.
 */
function hashToken(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

/**
 * Magento's GraphQL review payload carries no identifier of its own, so the key
 * is derived from the fields that together identify a review. Deriving it
 * deterministically (rather than from the position in the page) keeps the key
 * stable across pages, requests and cache entries.
 */
export function buildProductReviewKey(
  sku: string,
  review: MagentoProductReview,
): string {
  const source = [
    sku,
    review.created_at,
    review.nickname,
    review.summary,
    review.text,
  ].join('|');
  return `${sku}-${hashToken(source)}`;
}
