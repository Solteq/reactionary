/** The `storeConfig` slice the product reviews capability reads. */
export interface MagentoProductReviewStoreConfigResult {
  storeConfig?: {
    /** "1" when guests may write reviews, "0" otherwise. */
    allow_guests_to_write_product_reviews?: string | null;
  } | null;
}
