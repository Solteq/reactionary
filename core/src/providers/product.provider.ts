import type { Product } from '../schemas/models/product.model.js';
import { BaseProvider } from './base.provider.js';
import type { RequestContext } from '../schemas/session.schema.js';
import type { ProductQueryById, ProductQueryBySKU, ProductQueryBySlug } from '../schemas/queries/product.query.js';

export abstract class ProductProvider<
  T extends Product = Product
> extends BaseProvider<T> {


  /**
   * Get a product by its ID.
   * @param payload The query payload containing the product ID.
   * @param reqCtx The request context.
   *
   * Usecase: Not clear. Maybe if you get a reference from marketing? But that would most likely be a partnumber.
   * But what if the marketing system recommends products instead of variants? A product does not have a partnumber, or gtin.
   * Marketing will TYPICALLY recommend products, and in some cases maybe HeroVariants of a product.
   * In that case, you would need to resolve the product to its hero variant first, and then get the SKU from there.
   */
  public abstract getById(payload: ProductQueryById): Promise<T>;


  /**
   * Get a product by its slug.
   * @param payload The query payload containing the product slug.
   * @param reqCtx The request context.
   *
   * Usecase: You are rendering a product detail page, and you need to fetch the product by its slug.
   */
  public abstract getBySlug(payload: ProductQueryBySlug): Promise<T | null>;


  /**
   * Get a product by its SKU
   * @param payload
   * @param reqCtx
   *
   * Usecase: you want to look up product details for a cart item. Or you have a SKU from an external system (e.g. ERP, PIM, Marketing, OMS/Order History),
   * and you need to fetch the product details for that SKU. You will get the a Product back, with the variant matching the SKU set as heroSku.
   * It might also be used on a quick-order page, or product recommendations from external system.
   */
  public abstract getBySKU(payload: ProductQueryBySKU): Promise<T>;

  /**
   * Returns a set of Products for each variant. Is a paged response, to ensure we do not build in overfetching from the start.
   *
   * Usecase: You are rendering a variant-list on a b2b PDP page maybe, and it contains 500 variants. You do not want to fetch all 500 variants in one go.
   * @param payload
   * @param reqCtx
   */
//  public abstract getVariantList(payload: ProductQueryVariants, reqCtx: RequestContext): Promise<typeof this.parsePaginatedResult>;

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
