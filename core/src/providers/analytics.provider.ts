import { AnalyticsEvent } from '../schemas/analytics.schema';
import { Session } from '../schemas/session.schema';

export interface AnalyticsProvider {
    publish(event: AnalyticsEvent, session: Session): void;
    shutdown(): Promise<void>;
}
