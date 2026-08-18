import * as z from 'zod';

const LipscoreUserSchema = z.looseObject({
  id: z.number().optional(),
  name: z.string().optional(),
  short_name: z.string().optional(),
  email: z.string().optional(),
});

const LipscoreProductEmbedSchema = z.looseObject({
  name: z.string().nullable().optional(),
  gtin: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
  variant_id: z.string().nullable().optional(),
  mpn: z.string().nullable().optional(),
  internal_id: z.string().nullable().optional(),
});

// Items from GET /products/{id}/ratings — rating is 1–5 directly
export const LipscoreRatingSchema = z.looseObject({
  id: z.number(),
  created_at: z.string(),
  updated_at: z.string().optional(),
  status: z.string().nullable().optional(),
  lang: z.string().optional(),
  origin: z.string().optional(),
  rating: z.number(),
  user: LipscoreUserSchema.optional(),
  product: LipscoreProductEmbedSchema.optional(),
  internal_order_id: z.string().nullable().optional(),
  internal_customer_id: z.string().nullable().optional(),
});

export type LipscoreRating = z.infer<typeof LipscoreRatingSchema>;

export const LipscoreRatingsResponseSchema = z.array(LipscoreRatingSchema);
export type LipscoreRatingsResponse = z.infer<typeof LipscoreRatingsResponseSchema>;

const LipscoreReviewImageSchema = z.looseObject({
  id: z.number().optional(),
  thumb_url: z.string().optional(),
  image_url: z.string().optional(),
});

const LipscoreReviewReplySchema = z.looseObject({
  text: z.string().optional(),
  created_at: z.string().optional(),
  translated_text: z.string().nullable().optional(),
  member_site: z.string().optional(),
  lang: z.string().optional(),
});

// Items from GET /products/{id}/reviews — rating is 1–5 directly
export const LipscoreReviewSchema = z.looseObject({
  id: z.number(),
  text: z.string().nullable().optional(),
  translated_text: z.string().nullable().optional(),
  created_at: z.string(),
  votes_up: z.number().optional(),
  votes_down: z.number().optional(),
  purchase_date: z.string().nullable().optional(),
  rating: z.number(),
  user: LipscoreUserSchema.optional(),
  images: z.array(LipscoreReviewImageSchema).optional(),
  review_reply: z.union([LipscoreReviewReplySchema, z.null()]).optional(),
  testimonial: z.boolean().optional(),
  displayed_name: z.string().nullable().optional(),
  imported_at: z.string().optional(),
  product: LipscoreProductEmbedSchema.optional(),
  attributes: z.array(z.unknown()).optional(),
});

export type LipscoreReview = z.infer<typeof LipscoreReviewSchema>;

export const LipscoreReviewsResponseSchema = z.array(LipscoreReviewSchema);
export type LipscoreReviewsResponse = z.infer<typeof LipscoreReviewsResponseSchema>;

// Shape for GET /products?internal_id={x}
export const LipscoreProductListItemSchema = z.looseObject({
  id: z.number(),
  internal_id: z.string().optional(),
  votes: z.number().nullable().optional(),
  rating: z.string().nullable().optional(),
  review_count: z.number().nullable().optional(),
  reviews: z.array(LipscoreReviewSchema).default([]),
});

export const LipscoreProductsListSchema = z.array(LipscoreProductListItemSchema);
export type LipscoreProductListItem = z.infer<typeof LipscoreProductListItemSchema>;
