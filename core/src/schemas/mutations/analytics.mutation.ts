import { z } from 'zod';
import { BaseMutationSchema } from './base.mutation.js';
import {
  ProductIdentifierSchema,
  ProductSearchIdentifierSchema,
} from '../models/identifiers.model.js';
import type { InferType } from '../../zod-utils.js';

/**
 * Analytics event for when a page view has occured, whether that page view is virtual (as is the case with SPAs) or from a navigation
 * (as is the case with server-side rendering).
 */
export const AnalyticsMutationPageViewEventSchema = BaseMutationSchema.extend({
  /**
   * The type of the event, for uniquely identifying it amongst the set of possible events.
   */
  event: z.literal('page-view'),

  /**
   * The URL at which the page view occured. We record this separately instead of tracking it from the RequestContext, as the
   * client could in principle have buffered analytics events, and as such the page at the time of the server receiving the
   * event could have changed.
   */
  url: z.string(),
});

export const AnalyticsMutationSearchEventSchema = BaseMutationSchema.extend({
  /**
   * The type of the event, for uniquely identifying it amongst the set of possible events.
   */
  event: z.literal('product-search'),
  search: ProductSearchIdentifierSchema,
  products: z.array(ProductIdentifierSchema),
});

export const AnalyticsMutationSearchProductClickEventSchema =
  BaseMutationSchema.extend({
    /**
     * The type of the event, for uniquely identifying it amongst the set of possible events.
     */
    event: z.literal('product-search-click'),
    search: ProductSearchIdentifierSchema,
    product: ProductIdentifierSchema,
    position: z.number().min(0),
  });

export const AnalyticsMutationSchema = z.discriminatedUnion('event', [
  AnalyticsMutationPageViewEventSchema,
  AnalyticsMutationSearchEventSchema,
  AnalyticsMutationSearchProductClickEventSchema,
]);

/**
 * @see {@link AnalyticsMutationPageViewEventSchema}
 */
export type AnalyticsMutationPageViewEvent = InferType<
  typeof AnalyticsMutationPageViewEventSchema
>;

/**
 * @see {@link AnalyticsMutationSearchEventSchema}
 */
export type AnalyticsMutationSearchEvent = InferType<
  typeof AnalyticsMutationSearchEventSchema
>;

/**
 * @see {@link AnalyticsMutationSearchProductClickEventSchema}
 */
export type AnalyticsMutationSearchProductClickEvent = InferType<
  typeof AnalyticsMutationSearchProductClickEventSchema
>;

export type AnalyticsMutation = InferType<typeof AnalyticsMutationSchema>;
