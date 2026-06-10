import * as z from 'zod';

// ---------------------------------------------------------------------------
// User embedded in a review
// ---------------------------------------------------------------------------

const LipscoreReviewUserSchema = z.looseObject({
  id: z.number().optional(),
  name: z.string().optional(),
  short_name: z.string().optional(),
  email: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Image embedded in a review
// ---------------------------------------------------------------------------

const LipscoreReviewImageSchema = z.looseObject({
  thumb_url: z.string().optional(),
  image_url: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Individual review
// ---------------------------------------------------------------------------

export const LipscoreReviewSchema = z.looseObject({
  id: z.number(),
  text: z.string().optional(),
  translated_text: z.string().optional(),
  created_at: z.string(),
  votes_up: z.number().optional(),
  votes_down: z.number().optional(),
  purchase_date: z.string().optional(),
  rating: z.number(),
  user: LipscoreReviewUserSchema.optional(),
  images: z.array(LipscoreReviewImageSchema).optional(),
  review_reply: z.unknown().optional(),
  displayed_name: z.string().optional(),
  testimonial: z.boolean().optional(),
  attributes: z.array(z.unknown()).optional(),
});

export type LipscoreReview = z.infer<typeof LipscoreReviewSchema>;

// ---------------------------------------------------------------------------
// Product object returned by GET /products
// ---------------------------------------------------------------------------

export const LipscoreProductSchema = z.looseObject({
  internal_id: z.union([z.string(), z.number()]).optional(),
  reviews: z.array(LipscoreReviewSchema).default([]),
});

export type LipscoreProduct = z.infer<typeof LipscoreProductSchema>;

// ---------------------------------------------------------------------------
// Top-level response: array of products
// ---------------------------------------------------------------------------

export const LipscoreProductsResponseSchema = z.array(LipscoreProductSchema);

export type LipscoreProductsResponse = z.infer<
  typeof LipscoreProductsResponseSchema
>;
