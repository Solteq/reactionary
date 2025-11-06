import type { FacetIdentifier, FacetValueIdentifier } from '../index.js';
import type { ProductSearchResult, ProductSearchResultFacet, ProductSearchResultFacetValue, ProductSearchResultItem, ProductSearchResultItemVariant } from '../schemas/models/product-search.model.js';
import type { ProductSearchQueryByTerm } from '../schemas/queries/product-search.query.js';
import { BaseProvider } from './base.provider.js';

export abstract class ProductSearchProvider<
  T extends ProductSearchResultItem = ProductSearchResultItem
> extends BaseProvider<T> {
  protected override getResourceName(): string {
    return 'product-search';
  }

  public abstract queryByTerm(payload: ProductSearchQueryByTerm): Promise<ProductSearchResult>;

  /**
   * Parses a facet value from the search response.
   * @param facetValueIdentifier The identifier for the facet value.
   * @param label The label for the facet value.
   * @param count The count for the facet value.
   */
  protected abstract parseFacetValue(facetValueIdentifier: FacetValueIdentifier,  label: string, count: number) : ProductSearchResultFacetValue;

  /**
   * Parses a facet from the search response.
   * @param facetIdentifier The identifier for the facet.
   * @param facetValue The value for the facet.
   *
   * Usecase: Override this to customize the parsing of facets.
   */
  protected abstract parseFacet(facetIdentifier: FacetIdentifier,  facetValue: unknown) : ProductSearchResultFacet;

  /**
   * Parses a product variant from the search response.
   * @param variant The variant data from the search response.
   * @param product The product data from the search response.
   *
   * Usecase: Override this to customize the parsing of product variants.
   */
  protected abstract parseVariant(variant: unknown, product: unknown): ProductSearchResultItemVariant;



}


