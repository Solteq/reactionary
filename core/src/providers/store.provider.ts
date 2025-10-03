import type { Store } from '../schemas/models/store.model';
import type { StoreQueryByProximity } from '../schemas/queries';
import type { RequestContext } from '../schemas/session.schema';
import { BaseProvider } from './base.provider';

export abstract class StoreProvider<
  T extends Store = Store
> extends BaseProvider<T> {
  public abstract queryByProximity(payload: StoreQueryByProximity, reqCtx: RequestContext): Promise<Array<T>>;

  protected override getResourceName(): string {
    return 'store';
  }
}
