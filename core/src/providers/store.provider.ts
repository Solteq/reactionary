import type { Store } from '../schemas/models/store.model.js';
import type { StoreQueryByProximity } from '../schemas/queries/index.js';
import { BaseProvider } from './base.provider.js';

export abstract class StoreProvider extends BaseProvider {
  public abstract queryByProximity(payload: StoreQueryByProximity): Promise<Array<Store>>;

  protected override getResourceName(): string {
    return 'store';
  }
}
