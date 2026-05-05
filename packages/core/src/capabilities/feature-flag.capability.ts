import type { FeatureFlag } from "../schemas/models/feature-flags.model.js";
import type { FeatureFlagQueryGetFlags } from "../schemas/queries/feature-flag.query.js";
import type { Result } from "../schemas/result.js";
import { BaseCapability } from "./base.capability.js";

export abstract class FeatureFlagCapability<TFeatureFlag extends FeatureFlag = FeatureFlag> extends BaseCapability {
  protected override getResourceName(): string {
    return 'feature-flags';
  }

  public abstract getFlags(
    payload: FeatureFlagQueryGetFlags,
  ): Promise<Result<TFeatureFlag[]>>;


  public isEnabled(
    flags: TFeatureFlag[],
    key: string,
    variant?: string,
  ): boolean {
    const flag = flags.find((f) => f.identifier.key === key);
    if (!flag) {
      return false;
    }

    if (flag.type === 'boolean') {
      return flag.enabled;
    }

    if (variant) {
      if (flag.type === 'multivariate') {
        return flag.variants.some((v) => v.name === variant && v.enabled);
      }
      return false;
    }
    return false;
  }
}


