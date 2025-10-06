import type { Profile } from '../schemas/models';
import type { ProfileMutationUpdate } from '../schemas/mutations';
import type { ProfileQuerySelf } from '../schemas/queries';
import type { RequestContext } from '../schemas/session.schema';
import { BaseProvider } from './base.provider';

export abstract class ProfileProvider<
  T extends Profile = Profile
> extends BaseProvider<T> {
  public abstract getSelf(
    payload: ProfileQuerySelf,
    reqCtx: RequestContext
  ): Promise<T>;
  public abstract update(
    payload: ProfileMutationUpdate,
    reqCtx: RequestContext
  ): Promise<T>;

  protected override getResourceName(): string {
    return 'profile';
  }
}
