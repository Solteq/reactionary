import type { AnalyticsEvent, AnalyticsEventType, AnalyticsPurpose } from '../schemas/index.js';
import type { AnalyticsContext } from './context.js';
import type { AnalyticsSubscriber } from './dispatcher.js';

/**
 * Subscriber that records what it receives, for tests:
 * `await client.analytics.flush(); expect(recorder.events).toContainEqual(...)`.
 */
export class RecordingAnalyticsSubscriber implements AnalyticsSubscriber {
    readonly events: AnalyticsEvent[] = [];
    /** Lookup contexts the subscriber was handed, one per flush. */
    readonly contexts: AnalyticsContext[] = [];

    constructor(
        readonly name = 'recording',
        readonly types: ReadonlyArray<AnalyticsEventType | `${string}*`> = ['*'],
        readonly purpose: AnalyticsPurpose = 'necessary',
    ) {}

    async handle(event: AnalyticsEvent, ctx: AnalyticsContext): Promise<'accepted'> {
        this.events.push(event);
        if (!this.contexts.includes(ctx)) {
            this.contexts.push(ctx);
        }
        return 'accepted';
    }

    eventsOfType<K extends AnalyticsEventType>(type: K): AnalyticsEvent<K>[] {
        return this.events.filter((event): event is AnalyticsEvent<K> => event.type === type);
    }
}
