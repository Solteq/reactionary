import {
  PersonalizationProfileCapability,
  PersonalizationProfileQueryGetProfileSchema,
  PersonalizationProfileSchema,
  Reactionary,
  success,
  type Cache,
  type NotFoundError,
  type PersonalizationProfileFactory,
  type PersonalizationProfileFactoryOutput,
  type PersonalizationProfileFactoryWithOutput,
  type PersonalizationProfileQueryGetProfile,
  type RequestContext,
  type Result,
} from '@reactionary/core';
import type { HclConfiguration } from '../schema/configuration.schema.js';
import type { HclClient } from '../core/client.js';
import type { HclSegmentResponse } from '../schema/hcl.schema.js';
import type { HclPersonalizationProfileFactory } from '../factories/personalization-profile/personalization-profile.factory.js';
import { SESSION_KEY_PERSONALIZATION_ID } from '../core/session-keys.js';

export class HclPersonalizationProfileCapability<
  TFactory extends
    PersonalizationProfileFactory = HclPersonalizationProfileFactory,
> extends PersonalizationProfileCapability<
  PersonalizationProfileFactoryOutput<TFactory>
> {
  constructor(
    cache: Cache,
    context: RequestContext,
    protected readonly config: HclConfiguration,
    protected readonly client: HclClient,
    protected readonly factory: PersonalizationProfileFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
  }

  @Reactionary({
    inputSchema: PersonalizationProfileQueryGetProfileSchema,
    outputSchema: PersonalizationProfileSchema,
  })
  public override async getPersonalizationProfile(
    _payload: PersonalizationProfileQueryGetProfile,
  ): Promise<
    Result<PersonalizationProfileFactoryOutput<TFactory>, NotFoundError>
  > {
    const personalizationId = this.context.session[
      SESSION_KEY_PERSONALIZATION_ID
    ] as string | undefined;

    if (!personalizationId) {
      return success(
        this.factory.parsePersonalizationProfile(this.context, {
          personalizationId: 'anonymous',
          segments: [],
        }),
      );
    }

    const segments = await this.fetchSegments(personalizationId);

    return success(
      this.factory.parsePersonalizationProfile(this.context, {
        personalizationId,
        segments,
      }),
    );
  }

  /**
   * Calls the WCS segment API to retrieve the customer segments for the given
   * personalization ID. Returns an empty array when the API call fails or
   * returns no segment data.
   */
  protected async fetchSegments(personalizationId: string): Promise<string[]> {
    try {
      const response = await this.client.callGet<HclSegmentResponse>(
        this.getSegmentsUrl(),
        this.getSegmentsParams(personalizationId),
        { allowUndefined: true },
      );

      if (!response?.MemberGroup) {
        return [];
      }

      return response.MemberGroup.map((g) => g.displayName?.value).filter(
        (name): name is string => name !== undefined && name.length > 0,
      );
    } catch {
      return [];
    }
  }

  protected getSegmentsUrl(): string {
    return `${this.client.transactionBaseUrl}/segment`;
  }

  protected getSegmentsParams(personalizationId: string): URLSearchParams {
    const params = new URLSearchParams();
    params.set('q', 'byPersonalizationId');
    params.set('qPersonalizationId', personalizationId);
    return params;
  }
}
