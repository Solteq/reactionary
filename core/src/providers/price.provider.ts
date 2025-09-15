import { Price } from '../schemas/models/price.model';
import { PriceQueryBySku } from '../schemas/queries/price.query';
import { Session } from '../schemas/session.schema';
import { BaseProvider } from './base.provider';

export abstract class PriceProvider<
  T extends Price = Price
> extends BaseProvider<T> {
  public abstract getBySKU(payload: PriceQueryBySku, session: Session): Promise<T>;
}
