import * as z from 'zod';

// ---------------------------------------------------------------------------
// Statistics endpoint  GET /data/statistics.json
// ---------------------------------------------------------------------------

const BvRatingDistributionEntrySchema = z.looseObject({
  RatingValue: z.number(),
  Count: z.number(),
});

const BvReviewStatisticsSchema = z.looseObject({
  TotalReviewCount: z.number(),
  AverageOverallRating: z.number(),
  OverallRatingRange: z.number().optional(),
  RatingDistribution: z.array(BvRatingDistributionEntrySchema).optional(),
});

const BvProductStatisticsSchema = z.looseObject({
  ProductId: z.string(),
  ReviewStatistics: BvReviewStatisticsSchema,
});

const BvStatisticsResultSchema = z.looseObject({
  ProductStatistics: BvProductStatisticsSchema,
});

export const BvStatisticsResponseSchema = z.looseObject({
  HasErrors: z.boolean(),
  TotalResults: z.number().nullable().optional(),
  Results: z.array(BvStatisticsResultSchema),
  Errors: z
    .array(z.looseObject({ Message: z.string(), Code: z.string() }))
    .optional(),
});

export type BvStatisticsResponse = z.infer<typeof BvStatisticsResponseSchema>;
export type BvReviewStatistics = z.infer<typeof BvReviewStatisticsSchema>;

// ---------------------------------------------------------------------------
// Reviews endpoint  GET /data/reviews.json
// ---------------------------------------------------------------------------

export const BvReviewSchema = z.looseObject({
  Id: z.string(),
  AuthorId: z.string().optional(),
  UserNickname: z.string().optional(),
  Rating: z.number(),
  Title: z.string().optional(),
  ReviewText: z.string().optional(),
  SubmissionTime: z.string(),
  LastModificationTime: z.string().optional(),
  IsVerifiedPurchaser: z.boolean().optional(),
  ModerationStatus: z.string().optional(),
  ProductId: z.string().optional(),
});

export const BvReviewsResponseSchema = z.looseObject({
  HasErrors: z.boolean(),
  TotalResults: z.number().nullable().optional(),
  Offset: z.number().nullable().optional(),
  Limit: z.number().nullable().optional(),
  Results: z.array(BvReviewSchema),
  Errors: z
    .array(z.looseObject({ Message: z.string(), Code: z.string() }))
    .optional(),
});

export type BvReview = z.infer<typeof BvReviewSchema>;
export type BvReviewsResponse = z.infer<typeof BvReviewsResponseSchema>;

// ---------------------------------------------------------------------------
// Submit review endpoint  POST /data/submitreview.json
// ---------------------------------------------------------------------------

export const BvSubmitReviewResponseSchema = z.looseObject({
  HasErrors: z.boolean(),
  SubmissionId: z.string().optional(),
  Review: BvReviewSchema.optional(),
  FormErrors: z
    .looseObject({
      FieldErrors: z
        .record(
          z.string(),
          z.looseObject({ Message: z.string(), Code: z.string() }),
        )
        .optional(),
    })
    .optional(),
  Errors: z
    .array(z.looseObject({ Message: z.string(), Code: z.string() }))
    .optional(),
});

export type BvSubmitReviewResponse = z.infer<
  typeof BvSubmitReviewResponseSchema
>;
