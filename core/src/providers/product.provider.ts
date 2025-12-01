import type { Product } from '../schemas/models/product.model.js';
import { BaseProvider } from './base.provider.js';
import type { ProductQueryById, ProductQueryBySKU, ProductQueryBySlug } from '../schemas/queries/product.query.js';

export abstract class ProductProvider extends BaseProvider {


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
  public abstract getById(payload: ProductQueryById): Promise<Product>;


  /**
   * Get a product by its slug.
   * @param payload The query payload containing the product slug.
   * @param reqCtx The request context.
   *
   * Usecase: You are rendering a product detail page, and you need to fetch the product by its slug.
   */
  public abstract getBySlug(payload: ProductQueryBySlug): Promise<Product | null>;


  /**
   * Get a product by its SKU
   * @param payload
   * @param reqCtx
   *
   * Usecase: you want to look up product details for a cart item. Or you have a SKU from an external system (e.g. ERP, PIM, Marketing, OMS/Order History),
   * and you need to fetch the product details for that SKU. You will get the a Product back, with the variant matching the SKU set as heroSku.
   * It might also be used on a quick-order page, or product recommendations from external system.
   */
  public abstract getBySKU(payload: ProductQueryBySKU): Promise<Product>;

  protected createEmptyProduct(id: string): Product {
    // FIXME: We can probably get rid of this once we switch to errors as values, as we shouldn't even
    // be materializing an empty product...
    const product = {
      brand: '',
      description: '',
      identifier: {
        key: id
      },
      longDescription: '',
      mainVariant: {
        barcode: '',
        ean: '',
        gtin: '',
        identifier: {
          sku: ''
        },
        images: [],
        name: '',
        options: [],
        upc: ''
      },
      manufacturer: '',
      meta: {
        cache: {
          hit: false,
          key: ''
        },
        placeholder: true
      },
      name: '',
      options: [],
      parentCategories: [],
      published: false,
      sharedAttributes: [],
      slug: ''
    } satisfies Product;

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
