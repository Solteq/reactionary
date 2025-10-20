import type { AnalyticsEvent } from "../schemas/mutations/analytics.mutation.js";

export interface AnalyticsProvider {
  track(event: AnalyticsEvent): Promise<void>;
}
