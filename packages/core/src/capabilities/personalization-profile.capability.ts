import type { PersonalizationProfile } from "../schemas/models/personalization-profile.model.js";
import type { PersonalizationProfileQueryGetProfile } from "../schemas/queries/personalization-profile.query.js";
import type { NotFoundError } from "../schemas/errors/not-found.error.js";
import type { Result } from "../schemas/result.js";
import { BaseCapability } from "./base.capability.js";

export abstract class PersonalizationProfileCapability<TPersonalizationProfile extends PersonalizationProfile = PersonalizationProfile> extends BaseCapability {
  protected override getResourceName(): string {
    return 'personalization-profile';
  }

  public abstract getPersonalizationProfile(payload: PersonalizationProfileQueryGetProfile): Promise<Result<TPersonalizationProfile, NotFoundError>>;
}
