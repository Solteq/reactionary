import { Product } from '../schemas/models/product.model';
import { BaseProvider } from './base.provider';
import { Session } from '../schemas/session.schema';
import { ProductQueryById, ProductQueryBySlug } from '../schemas/queries/product.query';

export abstract class ProductProvider<
  T extends Product = Product
> extends BaseProvider<T> {
  public abstract getById(payload: ProductQueryById, session: Session): Promise<T>;
  public abstract getBySlug(payload: ProductQueryBySlug, session: Session): Promise<T>;
}
