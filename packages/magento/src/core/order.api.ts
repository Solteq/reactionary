import type { MagentoClient } from './client.js';
import {
  MagentoOrderCompanySchema,
  MagentoOrderIdListSchema,
  MagentoOrderItemSkuListSchema,
  type MagentoOrderCompany,
} from '../schema/order.types.js';

/**
 * Order lookups on top of the generic `MagentoClient` transports. All of
 * them run with the admin token: callers must have scoped the request to the
 * signed-in customer (a `customer_id` filter, or an ownership check) first.
 */

export type MagentoConditionType = 'eq' | 'neq' | 'in' | 'like' | 'gteq' | 'lteq';

/**
 * Builds Magento `searchCriteria` query parameters. Each `where` call adds its
 * own filter group, so filters are ANDed.
 */
export class MagentoSearchCriteria {
  protected params = new URLSearchParams();
  protected groups = 0;

  public where(field: string, value: string, condition: MagentoConditionType = 'eq'): this {
    const prefix = `searchCriteria[filterGroups][${this.groups}][filters][0]`;
    this.params.set(`${prefix}[field]`, field);
    this.params.set(`${prefix}[value]`, value);
    this.params.set(`${prefix}[condition_type]`, condition);
    this.groups += 1;
    return this;
  }

  public page(pageSize: number, currentPage: number): this {
    this.params.set('searchCriteria[pageSize]', String(pageSize));
    this.params.set('searchCriteria[currentPage]', String(currentPage));
    return this;
  }

  public sort(field: string, direction: 'ASC' | 'DESC'): this {
    this.params.set('searchCriteria[sortOrders][0][field]', field);
    this.params.set('searchCriteria[sortOrders][0][direction]', direction);
    return this;
  }

  /** Magento's REST field projection, e.g. `items[entity_id],total_count`. */
  public fields(projection: string): this {
    this.params.set('fields', projection);
    return this;
  }

  public clone(): MagentoSearchCriteria {
    const copy = new MagentoSearchCriteria();
    copy.params = new URLSearchParams(this.params);
    copy.groups = this.groups;
    return copy;
  }

  public toParams(): URLSearchParams {
    return new URLSearchParams(this.params);
  }
}

/**
 * Escapes the LIKE wildcards (and the escape character itself) so a search
 * term matches literally inside the `%…%` the caller wraps it in.
 */
export function escapeMagentoLikeValue(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Converts an ISO 8601 bound into Magento's UTC `YYYY-MM-DD HH:mm:ss`. A
 * date without a time covers that whole (UTC) day: it starts at 00:00:00
 * and, as an end bound, runs through 23:59:59. Undefined when unparseable.
 */
export function toMagentoDateTime(value: string, bound: 'start' | 'end'): string | undefined {
  if (DATE_ONLY.test(value)) {
    if (Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
      return undefined;
    }
    return `${value} ${bound === 'start' ? '00:00:00' : '23:59:59'}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

/** Thrown when an id scan would exceed its limit; callers map it to InvalidInput. */
export class MagentoOrderScanLimitError extends Error {
  public override readonly name = 'MagentoOrderScanLimitError';
  constructor(public readonly limit: number) {
    super(`More than ${limit} orders match; narrow the search (e.g. with a date range).`);
  }
}

const ID_SCAN_PAGE_SIZE = 300;
const ITEM_SCAN_PAGE_SIZE = 500;
const ITEM_SCAN_ORDER_CHUNK = 100;

/**
 * The entity ids of every order matching `criteria`, in the criteria's sort
 * order. Only ids are transferred (`fields` projection).
 */
export async function fetchMagentoOrderIds(
  client: MagentoClient,
  criteria: MagentoSearchCriteria,
  limit: number,
): Promise<number[]> {
  const ids: number[] = [];
  for (let page = 1; ; page += 1) {
    const params = criteria
      .clone()
      .page(ID_SCAN_PAGE_SIZE, page)
      .fields('items[entity_id],total_count')
      .toParams();
    const response = MagentoOrderIdListSchema.parse(await client.searchOrders(params));
    const pageIds = (response.items ?? []).map((item) => item.entity_id);
    const total = response.total_count ?? 0;
    if (total > limit) {
      throw new MagentoOrderScanLimitError(limit);
    }
    ids.push(...pageIds);
    // Magento answers a page past the end with the last page again, so stop on
    // the total rather than on an empty page.
    if (pageIds.length === 0 || ids.length >= total) {
      return ids;
    }
  }
}

/**
 * For the given orders, the subset of `skus` each one contains, read from
 * `/V1/orders/items` (sales order items).
 */
export async function fetchMagentoOrderSkus(
  client: MagentoClient,
  orderIds: readonly number[],
  skus: readonly string[],
): Promise<Map<number, Set<string>>> {
  const found = new Map<number, Set<string>>();
  for (let start = 0; start < orderIds.length; start += ITEM_SCAN_ORDER_CHUNK) {
    const chunk = orderIds.slice(start, start + ITEM_SCAN_ORDER_CHUNK);
    // `in` splits its value on commas, so a sku containing one is queried alone.
    const skuFilters: Array<[string, MagentoConditionType]> = skus.some((sku) => sku.includes(','))
      ? skus.map((sku) => [sku, 'eq'])
      : [[skus.join(','), 'in']];
    for (const [skuValue, skuCondition] of skuFilters) {
      const criteria = new MagentoSearchCriteria()
        .where('order_id', chunk.join(','), 'in')
        .where('sku', skuValue, skuCondition)
        .fields('items[order_id,sku],total_count');
      let seen = 0;
      for (let page = 1; ; page += 1) {
        const params = criteria.clone().page(ITEM_SCAN_PAGE_SIZE, page).toParams();
        const response = MagentoOrderItemSkuListSchema.parse(
          await client.adminRequest<unknown>('GET', `/V1/orders/items?${params.toString()}`),
        );
        const items = response.items ?? [];
        for (const item of items) {
          const orderSkus = found.get(item.order_id) ?? new Set<string>();
          orderSkus.add(item.sku);
          found.set(item.order_id, orderSkus);
        }
        seen += items.length;
        if (items.length === 0 || seen >= (response.total_count ?? 0)) {
          break;
        }
      }
    }
  }
  return found;
}

/**
 * Adobe Commerce B2B company by entity id. `companyId` must come from a
 * Magento payload the caller is entitled to (e.g. an owned order), never
 * from request input.
 */
export async function fetchMagentoOrderCompany(
  client: MagentoClient,
  companyId: number,
): Promise<MagentoOrderCompany> {
  return MagentoOrderCompanySchema.parse(
    await client.adminRequest<unknown>('GET', `/V1/company/${encodeURIComponent(String(companyId))}`),
  );
}

/** Session key holding the ids of the orders placed in this session. */
const PLACED_ORDERS_SESSION_KEY = 'order:placedOrderIds';
const PLACED_ORDERS_KEPT = 20;

function readOrderIds(raw: string | null): string[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

/**
 * Records an order as placed by this session, which entitles the session to
 * read it back through `MagentoOrderCapability.getById` even as a guest (the
 * order confirmation page). To be called by checkout right after placement.
 */
export async function rememberMagentoOrderPlacedInSession(
  client: MagentoClient,
  orderId: string | number,
): Promise<void> {
  const id = String(orderId);
  const ids = readOrderIds(await client.getSessionItem(PLACED_ORDERS_SESSION_KEY)).filter(
    (existing) => existing !== id,
  );
  ids.push(id);
  await client.setSessionItem(
    PLACED_ORDERS_SESSION_KEY,
    JSON.stringify(ids.slice(-PLACED_ORDERS_KEPT)),
  );
}

export async function wasMagentoOrderPlacedInSession(
  client: MagentoClient,
  orderId: string | number,
): Promise<boolean> {
  const ids = readOrderIds(await client.getSessionItem(PLACED_ORDERS_SESSION_KEY));
  return ids.includes(String(orderId));
}
