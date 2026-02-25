import type { AnalyticsCapabilityDefinition } from '@reactionary/core';
import type { GoogleAnalyticsProcedureContext } from '../../core/context.js';
import { googleAnalyticsTrack } from './analytics-track.js';

export const googleAnalyticsCapability = {
  analytics: {
    track: googleAnalyticsTrack,
  },
} satisfies AnalyticsCapabilityDefinition<GoogleAnalyticsProcedureContext>;
