import * as z from 'zod';

/** Magento's guest customer group ("NOT LOGGED IN"). */
export const MAGENTO_NOT_LOGGED_IN_GROUP_ID = 0;

/** `GET /V1/customerGroups/{id}` (admin REST). */
export const MagentoCustomerGroupSchema = z.looseObject({
  id: z.number(),
  code: z.string(),
});

/** Adobe Commerce 2.4.7+ `customerSegments(cartId)` storefront query. */
export const MagentoCustomerSegmentsResponseSchema = z.looseObject({
  customerSegments: z.array(z.looseObject({ uid: z.string() }).nullable()).nullable(),
});

export type MagentoCustomerGroup = z.output<typeof MagentoCustomerGroupSchema>;

/** What the personalization profile factory maps from. */
export interface MagentoPersonalizationProfileData {
  /** The Magento customer id, or `anonymous` for shoppers who aren't signed in. */
  customerId: string;
  groupId?: number;
  /** The group code, when resolved (see `personalizationResolveGroupCodes`). */
  groupCode?: string;
  /** Encoded customer segment uids, as returned by `customerSegments`. */
  segmentUids: string[];
}
