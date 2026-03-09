import * as z from 'zod';
import type { InferType } from '../../../zod-utils.js';
import { AnalyticsMutationProductAddToCartEventSchema } from './product-add-to-cart.mutation.js';
import { AnalyticsMutationProductDetailsViewEventSchema } from './product-details-view.mutation.js';
import { AnalyticsMutationProductSummaryClickEventSchema } from './product-summary-click.mutation.js';
import { AnalyticsMutationProductSummaryViewEventSchema } from './product-summary-view.mutation.js';
import { AnalyticsMutationPurchaseEventSchema } from './purchase.mutation.js';

export const AnalyticsMutationSchema = z.discriminatedUnion('event', [
  AnalyticsMutationProductSummaryViewEventSchema,
  AnalyticsMutationProductSummaryClickEventSchema,
  AnalyticsMutationProductDetailsViewEventSchema,
  AnalyticsMutationProductAddToCartEventSchema,
  AnalyticsMutationPurchaseEventSchema
]);

export type AnalyticsMutation = InferType<typeof AnalyticsMutationSchema>;

export * from './product-add-to-cart.mutation.js';
export * from './product-details-view.mutation.js';
export * from './product-summary-click.mutation.js';
export * from './product-summary-view.mutation.js';
export * from './purchase.mutation.js';
