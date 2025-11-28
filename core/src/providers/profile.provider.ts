import type { Profile } from '../schemas/models/index.js';
import type { ProfileMutationUpdate } from '../schemas/mutations/index.js';
import type { ProfileQuerySelf } from '../schemas/queries/index.js';
import { BaseProvider } from './base.provider.js';

export abstract class ProfileProvider extends BaseProvider {
  public abstract getSelf(payload: ProfileQuerySelf): Promise<Profile>;
  public abstract update(payload: ProfileMutationUpdate): Promise<Profile>;

  protected override getResourceName(): string {
    return 'profile';
  }
}
