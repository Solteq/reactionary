import type { Product } from '../schemas/models/product.model';
import { BaseProvider } from './base.provider';
import type { RequestContext } from '../schemas/session.schema';
import type { ProductQueryById, ProductQueryBySKU, ProductQueryBySlug } from '../schemas/queries/product.query';

export abstract class ProductProvider<
  T extends Product = Product
> extends BaseProvider<T> {
  public abstract getById(payload: ProductQueryById, reqCtx: RequestContext): Promise<T>;
  public abstract getBySlug(payload: ProductQueryBySlug, reqCtx: RequestContext): Promise<T | null>;
  public abstract getBySKU(payload: ProductQueryBySKU | ProductQueryBySKU[], reqCtx: RequestContext): Promise<T>;

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
