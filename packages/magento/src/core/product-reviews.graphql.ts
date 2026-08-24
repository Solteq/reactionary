/**
 * Magento's REST API carries no reviews or ratings, so everything the product
 * reviews capability needs is fetched through the GraphQL endpoint. Reviews are
 * reachable only as a nested field on `products`, which is why every document
 * here starts from a single-SKU product lookup.
 */

const REVIEW_FIELDS = `
  average_rating
  created_at
  nickname
  summary
  text
  ratings_breakdown {
    name
    value
  }
`;

export const PRODUCT_RATING_SUMMARY_QUERY = `
  query ReactionaryProductRatingSummary($sku: String!) {
    products(filter: { sku: { eq: $sku } }, pageSize: 1, currentPage: 1) {
      items {
        sku
        rating_summary
        review_count
      }
    }
  }
`;

export const PRODUCT_REVIEWS_QUERY = `
  query ReactionaryProductReviews($sku: String!, $pageSize: Int!, $currentPage: Int!) {
    products(filter: { sku: { eq: $sku } }, pageSize: 1, currentPage: 1) {
      items {
        sku
        rating_summary
        review_count
        reviews(pageSize: $pageSize, currentPage: $currentPage) {
          items {
${REVIEW_FIELDS}
          }
          page_info {
            page_size
            current_page
            total_pages
          }
        }
      }
    }
  }
`;

export const PRODUCT_REVIEW_RATINGS_METADATA_QUERY = `
  query ReactionaryProductReviewRatingsMetadata {
    productReviewRatingsMetadata {
      items {
        id
        name
        values {
          value_id
          value
        }
      }
    }
  }
`;

export const CREATE_PRODUCT_REVIEW_MUTATION = `
  mutation ReactionaryCreateProductReview($input: CreateProductReviewInput!) {
    createProductReview(input: $input) {
      review {
${REVIEW_FIELDS}
      }
    }
  }
`;
