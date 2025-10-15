import type { Store } from '../schemas/models/store.model.js';
import type { StoreQueryByProximity } from '../schemas/queries/index.js';
import type { RequestContext } from '../schemas/session.schema.js';
import { BaseProvider } from './base.provider.js';

export abstract class StoreProvider<
  T extends Store = Store
> extends BaseProvider<T> {
  public abstract queryByProximity(payload: StoreQueryByProximity, reqCtx: RequestContext): Promise<Array<T>>;

  protected override getResourceName(): string {
    return 'store';
  }
}
