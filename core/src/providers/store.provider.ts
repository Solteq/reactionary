import type { Store } from '../schemas/models/store.model.js';
import type { StoreQueryByProximity } from '../schemas/queries/index.js';
import { BaseProvider } from './base.provider.js';

export abstract class StoreProvider<
  T extends Store = Store
> extends BaseProvider<T> {
  public abstract queryByProximity(payload: StoreQueryByProximity): Promise<Array<T>>;

  protected override getResourceName(): string {
    return 'store';
  }
}
