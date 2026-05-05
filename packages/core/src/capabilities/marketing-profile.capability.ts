import type { MarketingProfile } from "../schemas/models/marketing-profile.model.js";
import type { MarketingProfileQueryGetProfile } from "../schemas/queries/marketing-profile.query.js";
import type { NotFoundError } from "../schemas/errors/not-found.error.js";
import type { Result } from "../schemas/result.js";
import { BaseCapability } from "./base.capability.js";

export abstract class MarketingProfileCapability<TMarketingProfile extends MarketingProfile = MarketingProfile> extends BaseCapability {
  protected override getResourceName(): string {
    return 'marketing-profile';
  }

  public abstract getMarketingProfile(payload: MarketingProfileQueryGetProfile): Promise<Result<TMarketingProfile, NotFoundError>>;
}
