import type { ProductIdentifier, ProductVariantIdentifier } from "../schemas/index.js";
import type { ProductAssociationsGetAccessoriesQuery, ProductAssociationsGetSparepartsQuery, ProductAssociationsGetReplacementsQuery } from "../schemas/queries/product-associations.query.js";
import { BaseProvider } from "./base.provider.js";


/**
 * The product association provider is responsible for providing evidence based associations between products, such as
 * accessories, spareparts, and replacements. These associations are typically used to provide recommendations to customers on the product detail page, but can also be used in other contexts such as the cart or post-purchase, but
 * do not carry any personalization concept to them.
 */
export abstract class ProductAssociationsProvider extends BaseProvider {

  /**
   * Returns a list of product identifiers which are accessories to the given product.
   * Accessories in are products in their own right, but are commonly purchased alongside or recommended as complementary to the main product. Examples of accessories include:
   * - A phone case for a smartphone
   * - A camera bag for a camera
   *
   *
   * Usecase:
   * - PDP: Accessories for this product
   */
  public abstract getAccessories(query: ProductAssociationsGetAccessoriesQuery): Promise<ProductVariantIdentifier[]>;

  /**
   * Returns a list of product identifiers which are spareparts to the given product.
   * Spareparts are products which are necessary for the use of the main product, but are not typically purchased alongside it. Examples of spareparts include:
   *
   * Usecase:
   * - PDP: Accessories for this product
   */
  public abstract getSpareparts(query: ProductAssociationsGetSparepartsQuery): Promise<ProductVariantIdentifier[]>;


  /**
   * This product is replaced by these equivalent or newer products
   * @param query
   */
  public abstract getReplacements(query: ProductAssociationsGetReplacementsQuery): Promise<ProductVariantIdentifier[]>;


  getResourceName(): string {
    return 'product-associations';
  }




}
