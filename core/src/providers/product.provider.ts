import { Product } from '../schemas/models/product.model';
import { BaseProvider } from './base.provider';
import { Session } from '../schemas/session.schema';
import { ProductQueryById, ProductQueryBySlug } from '../schemas/queries/product.query';

export abstract class ProductProvider<
  T extends Product = Product
> extends BaseProvider<T> {
  public abstract getById(payload: ProductQueryById, session: Session): Promise<T>;
  public abstract getBySlug(payload: ProductQueryBySlug, session: Session): Promise<T | null>;


  protected createEmptyProduct(id: string): T {
    const product = this.newModel();
    product.identifier = { key: id };
    product.meta.placeholder = true;
    return product;
  }

  /**
   * The resource name, used for caching and logging.
   * @returns
   */
  protected override getResourceName(): string {
    return 'product';
  }
}
