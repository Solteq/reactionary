import { Product } from '../schemas/models/product.model';
import { ProductQuery } from '../schemas/queries/product.query';
import { Session } from '../schemas/session.schema';
import { BaseProvider } from './base.provider';

export abstract class ProductProvider<T = Product> extends BaseProvider<T> {
  public abstract override parse(data: unknown, query: ProductQuery): T;
  public abstract override query(query: ProductQuery, session: Session): Promise<T>;
}
