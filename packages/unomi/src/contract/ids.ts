import { hash } from 'node:crypto';

/** What Unomi accepts as an `itemId` (the `item` base schema): word characters, `-_@.`, at most 60 characters. */
export const UNOMI_ITEM_ID_PATTERN = /^(\w|[-_@.]){0,60}$/;

/**
 * The `itemId` for a reactionary key (product key, category key, store id, ...).
 *
 * A key that Unomi accepts is used as it is. Any other key (a slash, a space, too long) becomes `h-` plus the first 40 hex
 * characters of its SHA-256, so the same key always gets the same id and the event is not dropped. The readable key travels
 * in the item's `name` or `properties`.
 */
export function unomiItemId(key: string): string {
  if (key.length > 0 && UNOMI_ITEM_ID_PATTERN.test(key)) {
    return key;
  }
  return `h-${hash('sha256', key).slice(0, 40)}`;
}
