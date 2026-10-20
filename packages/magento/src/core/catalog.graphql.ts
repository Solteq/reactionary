/**
 * The REST product search (`/V1/products`) returns no aggregations, so the
 * search facets are read from the storefront GraphQL `products` query. Only
 * the aggregations are requested (`pageSize: 1`): the result items still come
 * from REST. The call is made anonymously or with the shopper's own token,
 * never with the integration token.
 */
export const PRODUCT_AGGREGATIONS_QUERY = `
  query ReactionaryProductAggregations($search: String, $filter: ProductAttributeFilterInput) {
    products(search: $search, filter: $filter, pageSize: 1, currentPage: 1) {
      aggregations {
        attribute_code
        label
        count
        options {
          label
          value
          count
        }
      }
    }
  }
`;
