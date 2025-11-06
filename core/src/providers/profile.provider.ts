import type { Profile } from '../schemas/models/index.js';
import type { ProfileMutationUpdate } from '../schemas/mutations/index.js';
import type { ProfileQuerySelf } from '../schemas/queries/index.js';
import { BaseProvider } from './base.provider.js';

export abstract class ProfileProvider<
  T extends Profile = Profile
> extends BaseProvider<T> {
  public abstract getSelf(
    payload: ProfileQuerySelf
  ): Promise<T>;
  public abstract update(
    payload: ProfileMutationUpdate
  ): Promise<T>;

  protected override getResourceName(): string {
    return 'profile';
  }
}
