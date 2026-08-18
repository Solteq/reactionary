import type {
  AnyProductRecommendationSchema,
  ProductRecommendationSchema,
  ProductRecommendationsFactory,
  RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';
import type { HclEspotActivityData } from '../../schema/hcl.schema.js';

export interface HclEspotRecommendationData {
  activityData: HclEspotActivityData;
  algorithm: string;
}

export class HclProductRecommendationsFactory<
  TProductRecommendationSchema extends
    AnyProductRecommendationSchema = typeof ProductRecommendationSchema,
> implements ProductRecommendationsFactory<TProductRecommendationSchema>
{
  public readonly productRecommendationSchema: TProductRecommendationSchema;

  constructor(productRecommendationSchema: TProductRecommendationSchema) {
    this.productRecommendationSchema = productRecommendationSchema;
  }

  public parseRecommendation(
    _context: RequestContext,
    data: HclEspotRecommendationData,
  ): z.output<TProductRecommendationSchema> {
    // partNumber returned inline is preferred; fall back to contentId (internal uniqueID)
    const key =
      data.activityData.partNumber ?? data.activityData.contentId ?? '';
    return this.productRecommendationSchema.parse({
      recommendationIdentifier: { key, algorithm: data.algorithm },
      recommendationReturnType: 'idOnly',
      product: { key },
    });
  }
}
