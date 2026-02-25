import type { AnalyticsCapabilityDefinition } from '@reactionary/core';
import type { AlgoliaProcedureContext } from '../../core/context.js';
import { algoliaAnalyticsTrack } from './analytics-track.js';

export const algoliaAnalyticsCapability = {
  analytics: {
    track: algoliaAnalyticsTrack,
  },
} satisfies AnalyticsCapabilityDefinition<AlgoliaProcedureContext>;
