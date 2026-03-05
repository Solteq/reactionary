import type { Store } from '../schemas/models/store.model.js';
import type { StoreQueryByProximity } from '../schemas/queries/index.js';
import type { Result } from '../schemas/result.js';
import { BaseProvider } from './base.provider.js';

export abstract class StoreProvider<TStore extends Store = Store> extends BaseProvider {
  public abstract queryByProximity(payload: StoreQueryByProximity): Promise<Result<Array<TStore>>>;

  protected override getResourceName(): string {
    return 'store';
  }
}
