import type { Store } from '../schemas/models/store.model.js';
import type { StoreQueryByProximity } from '../schemas/queries/index.js';
import type { Result } from '../schemas/result.js';
import { BaseProvider } from './base.provider.js';

export abstract class StoreProvider extends BaseProvider {
  public abstract queryByProximity(payload: StoreQueryByProximity): Promise<Result<Array<Store>>>;

  protected override getResourceName(): string {
    return 'store';
  }
}
