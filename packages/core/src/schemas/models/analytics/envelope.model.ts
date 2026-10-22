import * as z from 'zod';
import type { InferType } from '../../../zod-utils.js';
import { PersonalizationProfileIdentifierSchema } from '../identifiers.model.js';
import { IdentitySchema } from '../identity.model.js';
import { CurrencySchema } from '../currency.model.js';
import { AnalyticsConsentSchema } from './consent.model.js';
import { OriginSchema } from './origin.model.js';

export const AnalyticsPageSchema = z.looseObject({
    url: z.string().optional(),
    title: z.string().optional(),
    referrer: z.string().optional(),
});

/**
 * Request state captured at emit time. Dispatch happens later, after the session may have changed.
 */
export const EventContextSnapshotSchema = z.looseObject({
    marketingIdentifier: PersonalizationProfileIdentifierSchema.meta({ description: 'The marketing (CDP) identifier of the visitor at emit time.' }),
    identity: IdentitySchema.meta({ description: 'The identity of the visitor at emit time. Anonymous when not logged in.' }),
    locale: z.string(),
    currency: CurrencySchema,
    consent: AnalyticsConsentSchema.optional().meta({ description: 'Consent at emit time. Absent when the request carried none and no default applied.' }),
    page: AnalyticsPageSchema.optional(),
    userAgent: z.string().optional().meta({ description: 'The user agent of the visitor\'s request, if known. Delivery happens after the request, so subscribers cannot read it from the request context later.' }),
    clientIp: z.string().optional().meta({ description: 'The IP address of the visitor\'s request, if known. Personal data: capturing it does not forward it, each subscriber decides what to send to its vendor.' }),
    isBot: z.boolean().optional().meta({ description: 'True if the request was identified as a bot or crawler.' }),
});

/**
 * Fields shared by every event. The per-type `type` and `payload` are added by the event union.
 */
export const AnalyticsEventEnvelopeSchema = z.looseObject({
    id: z.string().meta({ description: 'Unique event id (UUID). Used for deduplication by vendors and for debugging.' }),
    occurredAt: z.iso.datetime().meta({ description: 'ISO timestamp taken when the storefront emitted the event.' }),
    origin: OriginSchema.optional(),
    properties: z.record(z.string(), z.unknown()).optional().meta({ description: 'Storefront-only knowledge. Not a channel for product data; providers look that up.' }),
    context: EventContextSnapshotSchema,
});

export const AnalyticsEventResultSchema = z.looseObject({
    eventId: z.string().meta({ description: 'The id assigned to the enqueued event.' }),
});

export type AnalyticsPage = InferType<typeof AnalyticsPageSchema>;
export type EventContextSnapshot = InferType<typeof EventContextSnapshotSchema>;
export type AnalyticsEventEnvelope = InferType<typeof AnalyticsEventEnvelopeSchema>;
export type AnalyticsEventResult = InferType<typeof AnalyticsEventResultSchema>;
