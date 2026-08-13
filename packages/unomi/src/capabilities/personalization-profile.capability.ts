import {
  PersonalizationProfileCapability,
  PersonalizationProfileQueryGetProfileSchema,
  PersonalizationProfileSchema,
  Reactionary,
  error,
  success,
  type Cache,
  type NotFoundError,
  type PersonalizationProfileFactory,
  type PersonalizationProfileFactoryOutput,
  type PersonalizationProfileFactoryWithOutput,
  type PersonalizationProfileQueryGetProfile,
  type Identity,
  type RequestContext,
  type Result,
} from '@reactionary/core';
import {
  type UnomiProfileResponse,
  type UnomiPersonalizationProfileFactory,
} from '../factories/personalization-profile/personalization-profile.factory.js';
import type { UnomiConfiguration } from '../schema/configuration.schema.js';
import { UnomiAPI } from '../core/client.js';
import { SESSION_KEY_PERSONALIZATION_ID, SESSION_KEY_UNOMI_SESSION_ID } from '../core/session-keys.js';

export class UnomiPersonalizationProfileCapability<
  TFactory extends PersonalizationProfileFactory = UnomiPersonalizationProfileFactory,
> extends PersonalizationProfileCapability<PersonalizationProfileFactoryOutput<TFactory>> {
  protected readonly api: UnomiAPI;

  constructor(
    protected readonly config: UnomiConfiguration,
    cache: Cache,
    context: RequestContext,
    protected readonly factory: PersonalizationProfileFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.api = new UnomiAPI(config, context);
  }


  @Reactionary({
    inputSchema: PersonalizationProfileQueryGetProfileSchema,
    outputSchema: PersonalizationProfileSchema,
  })
  public override async getPersonalizationProfile(
    payload: PersonalizationProfileQueryGetProfile,
  ): Promise<Result<PersonalizationProfileFactoryOutput<TFactory>, NotFoundError>> {

    const newId = globalThis.crypto.randomUUID();
    const profileId = payload.personalizationProfileIdentifier?.key ?? newId;

    const response = await this.api.getProfile(profileId);
    if (response.status === 404) {
      return error({ type: 'NotFound', identifier: { key: profileId } });
    }
    if (!response.ok) {
      throw new Error(`Unomi profile request failed with status ${response.status}`);
    }

    if (response.status === 204) {
      return success(this.factory.parsePersonalizationProfile(this.context, {
        profileId,
      }));
    }

    const profile = await response.json() as UnomiProfileResponse;
    return success(this.factory.parsePersonalizationProfile(this.context, {
      ...profile,
      profileId,
    }));
  }

  protected async hash(value: string): Promise<string> {
    const digest = await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(value),
    );
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
}
