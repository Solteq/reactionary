import * as z from 'zod';
import type { InferType } from '../../../zod-utils.js';
import { AnalyticsConsentSchema, AnalyticsPurposeSchema } from './consent.model.js';

/**
 * Keeps work alive after the response has been sent, e.g. Next's `after`.
 */
export type AnalyticsWaitUntil = (promise: Promise<unknown>) => void;

/**
 * The declarative part of an analytics subscriber. `handle` is a member of the subscriber itself.
 */
export const AnalyticsSubscriberDescriptorSchema = z.looseObject({
    name: z.string().min(1).meta({ description: 'Unique subscriber name, e.g. "unomi" or "algolia". Used in logs and tracing.' }),
    types: z.array(z.string().min(1)).min(1).meta({ description: 'Event types handled: an exact type, a prefix wildcard such as "cart-*", or "*".' }),
    purpose: AnalyticsPurposeSchema,
});

export const AnalyticsDispatchOptionsSchema = z.looseObject({
    waitUntil: z.custom<AnalyticsWaitUntil>((value) => typeof value === 'function', 'waitUntil must be a function').optional().meta({ description: 'Called with the delivery promise so the runtime keeps it alive after the response. Without it, delivery is fire-and-forget with errors logged.' }),
    defaultConsent: AnalyticsConsentSchema.optional().meta({ description: 'Consent applied when the session carries none. Defaults to everything granted, which preserves behaviour from before consent existed.' }),
});

export type AnalyticsSubscriberDescriptor = InferType<typeof AnalyticsSubscriberDescriptorSchema>;
// InferType strips function types down to {}, so `waitUntil` is spelled out.
export type AnalyticsDispatchOptions = Omit<InferType<typeof AnalyticsDispatchOptionsSchema>, 'waitUntil'> & { waitUntil?: AnalyticsWaitUntil };
