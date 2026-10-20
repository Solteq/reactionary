/**
 * Adobe Commerce 2.4.7+ storefront query for the shopper's customer segments.
 * Sent with the customer token for signed-in customers; the cart id must be a
 * masked (GraphQL) cart id belonging to the shopper.
 */
export const CUSTOMER_SEGMENTS_QUERY = `
  query ReactionaryCustomerSegments($cartId: String!) {
    customerSegments(cartId: $cartId) {
      uid
    }
  }
`;
