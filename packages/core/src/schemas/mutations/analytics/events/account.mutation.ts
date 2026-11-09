import * as z from 'zod';
import type { InferType } from '../../../../zod-utils.js';
import { AnalyticsConsentSchema } from '../../../models/analytics/consent.model.js';
import { AnalyticsChannelSchema, AnalyticsProductRefSchema, AnalyticsStoreRefSchema } from '../../../models/analytics/event-parts.model.js';
import { IdentitySchema } from '../../../models/identity.model.js';
import { PersonalizationProfileIdentifierSchema, ProductListIdentifierSchema, ProductVariantIdentifierSchema } from '../../../models/identifiers.model.js';
import { ProfileSchema } from '../../../models/profile.model.js';
import { AnalyticsEventMutationBaseSchema } from './base.mutation.js';

// Account / identity
export const AnalyticsMutationUserLoggedInSchema = AnalyticsEventMutationBaseSchema.extend({
    identity: IdentitySchema.meta({ description: 'The identity after login.' }),
    previousMarketingId: PersonalizationProfileIdentifierSchema.optional().meta({ description: 'The marketing identifier the visitor had before logging in, so CDPs can merge profiles. Login does not rotate the marketing identifier in core, so the storefront supplies it when it knows it.' }),
});

export const AnalyticsMutationUserLoggedOutSchema = AnalyticsEventMutationBaseSchema.extend({});

export const AnalyticsMutationUserRegisteredSchema = AnalyticsEventMutationBaseSchema.extend({
    identity: IdentitySchema,
});

export const AnalyticsMutationProfileUpdatedSchema = AnalyticsEventMutationBaseSchema.extend({
    profile: ProfileSchema,
    changedFields: z.array(z.string()).optional(),
});

export const AnalyticsMutationConsentChangedSchema = AnalyticsEventMutationBaseSchema.extend({
    consent: AnalyticsConsentSchema.meta({ description: 'The new consent. Also applies to subsequent events in this request.' }),
});

export const AnalyticsMutationNewsletterSubscribedSchema = AnalyticsEventMutationBaseSchema.extend({
    channel: AnalyticsChannelSchema.optional(),
});

// Engagement
export const AnalyticsMutationWishlistItemAddedSchema = AnalyticsEventMutationBaseSchema.extend({
    list: ProductListIdentifierSchema,
    variant: ProductVariantIdentifierSchema,
});

export const AnalyticsMutationWishlistItemRemovedSchema = AnalyticsEventMutationBaseSchema.extend({
    list: ProductListIdentifierSchema,
    variant: ProductVariantIdentifierSchema,
});

export const AnalyticsMutationBackInStockRequestedSchema = AnalyticsEventMutationBaseSchema.extend({
    variant: ProductVariantIdentifierSchema,
});

export const AnalyticsMutationReviewSubmittedSchema = AnalyticsEventMutationBaseSchema.extend({
    product: AnalyticsProductRefSchema,
    rating: z.number().min(0),
});

export const AnalyticsMutationStoreSelectedSchema = AnalyticsEventMutationBaseSchema.extend({
    store: AnalyticsStoreRefSchema,
});

export const AnalyticsMutationProductSharedSchema = AnalyticsEventMutationBaseSchema.extend({
    product: AnalyticsProductRefSchema,
    channel: AnalyticsChannelSchema.optional(),
});

export const AnalyticsMutationExperimentExposedSchema = AnalyticsEventMutationBaseSchema.extend({
    experimentKey: z.string().min(1).meta({ description: 'The experiment, as defined in the CMS.' }),
    version: z.string().min(1).meta({ description: 'The version of the experiment the visitor was shown, the control included. Send it once per session, when the version is rendered.' }),
});

export const AnalyticsMutationTraitDeclaredSchema = AnalyticsEventMutationBaseSchema.extend({
    trait: z.string().min(1).meta({ description: 'What the visitor declared about themselves, e.g. "trade". A lowercase slug.' }),
    value: z.string().min(1).meta({ description: 'The declared value, e.g. "electrician". A lowercase slug. Never personal data.' }),
});

// Escape hatch
export const AnalyticsMutationCustomSchema = AnalyticsEventMutationBaseSchema.extend({
    name: z.string().min(1).meta({ description: 'The custom event name. Providers ignore names they do not recognise.' }),
    payload: z.record(z.string(), z.unknown()),
});

export type AnalyticsMutationUserLoggedIn = InferType<typeof AnalyticsMutationUserLoggedInSchema>;
export type AnalyticsMutationUserLoggedOut = InferType<typeof AnalyticsMutationUserLoggedOutSchema>;
export type AnalyticsMutationUserRegistered = InferType<typeof AnalyticsMutationUserRegisteredSchema>;
export type AnalyticsMutationProfileUpdated = InferType<typeof AnalyticsMutationProfileUpdatedSchema>;
export type AnalyticsMutationConsentChanged = InferType<typeof AnalyticsMutationConsentChangedSchema>;
export type AnalyticsMutationNewsletterSubscribed = InferType<typeof AnalyticsMutationNewsletterSubscribedSchema>;
export type AnalyticsMutationWishlistItemAdded = InferType<typeof AnalyticsMutationWishlistItemAddedSchema>;
export type AnalyticsMutationWishlistItemRemoved = InferType<typeof AnalyticsMutationWishlistItemRemovedSchema>;
export type AnalyticsMutationBackInStockRequested = InferType<typeof AnalyticsMutationBackInStockRequestedSchema>;
export type AnalyticsMutationReviewSubmitted = InferType<typeof AnalyticsMutationReviewSubmittedSchema>;
export type AnalyticsMutationStoreSelected = InferType<typeof AnalyticsMutationStoreSelectedSchema>;
export type AnalyticsMutationProductShared = InferType<typeof AnalyticsMutationProductSharedSchema>;
export type AnalyticsMutationExperimentExposed = InferType<typeof AnalyticsMutationExperimentExposedSchema>;
export type AnalyticsMutationTraitDeclared = InferType<typeof AnalyticsMutationTraitDeclaredSchema>;
export type AnalyticsMutationCustom = InferType<typeof AnalyticsMutationCustomSchema>;
