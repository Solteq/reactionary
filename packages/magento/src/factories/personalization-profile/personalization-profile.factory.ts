import type {
  AnyPersonalizationProfileSchema,
  PersonalizationProfile,
  PersonalizationProfileFactory,
  PersonalizationProfileSchema,
  RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';
import type { MagentoPersonalizationProfileData } from '../../schema/personalization.types.js';

/**
 * Decodes a Magento GraphQL uid (base64 of the entity id). Returns the uid
 * itself when it isn't a base64-encoded id.
 */
export function decodeMagentoUid(uid: string): string {
  try {
    const decoded = atob(uid);
    return /^\d+$/.test(decoded) ? decoded : uid;
  } catch {
    return uid;
  }
}

/**
 * Maps a Magento customer's group and (Adobe Commerce) customer segments onto
 * a personalization profile:
 * - identifier key: the Magento customer id, `anonymous` for guests;
 * - segments: `customer-group:<code or id>` followed by
 *   `customer-segment:<segment id>` for each segment;
 * - blurb: a one-line summary.
 */
export class MagentoPersonalizationProfileFactory<
  TPersonalizationProfileSchema extends AnyPersonalizationProfileSchema = typeof PersonalizationProfileSchema,
> implements PersonalizationProfileFactory<TPersonalizationProfileSchema>
{
  public readonly personalizationProfileSchema: TPersonalizationProfileSchema;

  constructor(personalizationProfileSchema: TPersonalizationProfileSchema) {
    this.personalizationProfileSchema = personalizationProfileSchema;
  }

  protected groupSegment(data: MagentoPersonalizationProfileData): string | undefined {
    const group = data.groupCode ?? (data.groupId === undefined ? undefined : String(data.groupId));
    return group === undefined ? undefined : `customer-group:${group}`;
  }

  protected parseBlurb(data: MagentoPersonalizationProfileData): string {
    const who = data.customerId === 'anonymous' ? 'Guest shopper' : `Magento customer ${data.customerId}`;
    const group =
      data.groupCode ?? (data.groupId === undefined ? undefined : `group ${data.groupId}`);
    const parts = [who];
    if (group) {
      parts.push(`in customer group ${group}`);
    }
    if (data.segmentUids.length > 0) {
      parts.push(`with ${data.segmentUids.length} customer segment(s)`);
    }
    return parts.join(' ');
  }

  public parsePersonalizationProfile(
    _context: RequestContext,
    data: MagentoPersonalizationProfileData,
  ): z.output<TPersonalizationProfileSchema> {
    const groupSegment = this.groupSegment(data);
    const segments = [
      ...(groupSegment ? [groupSegment] : []),
      ...data.segmentUids.map((uid) => `customer-segment:${decodeMagentoUid(uid)}`),
    ];

    const result = {
      identifier: { key: data.customerId },
      segments,
      blurb: this.parseBlurb(data),
    } satisfies PersonalizationProfile;

    return this.personalizationProfileSchema.parse(result);
  }
}
