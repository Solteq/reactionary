import { AsyncLocalStorage } from 'node:async_hooks';
import { traceSpan } from '../decorators/reactionary.decorator.js';
import {
    AnalyticsEventMutationSchemas,
    AnalyticsEventSchema,
    AnalyticsMutationConsentChangedSchema,
    AnalyticsSubscriberDescriptorSchema,
} from '../schemas/index.js';
import type {
    AnalyticsConsent,
    AnalyticsDispatchOptions,
    AnalyticsEvent,
    AnalyticsEventResult,
    AnalyticsEventType,
    AnalyticsOutcome,
    AnalyticsPurpose,
    EventContextSnapshot,
    InvalidInputError,
    RequestContext,
    Result,
} from '../schemas/index.js';
import type * as z from 'zod';
import type { InferType } from '../zod-utils.js';
import { error, success } from '../schemas/result.js';
import type { AnalyticsContext } from './context.js';

/**
 * Receives analytics events from the dispatcher. Providers (Unomi, Algolia, ...) and custom subscribers implement this.
 * Subscriptions are fixed when the client is built.
 */
export interface AnalyticsSubscriber<K extends AnalyticsEventType = AnalyticsEventType> {
    readonly name: string;
    /** Exact event types, prefix wildcards such as `cart-*`, or `*`. */
    readonly types: ReadonlyArray<K | `${string}*`>;
    readonly purpose: AnalyticsPurpose;
    handle(event: AnalyticsEvent<K>, ctx: AnalyticsContext): Promise<AnalyticsOutcome | void>;
}

/** The input of the helper for event type `K`: its required arguments plus `origin` and `properties`. */
export type AnalyticsEventInput<K extends AnalyticsEventType> = InferType<(typeof AnalyticsEventMutationSchemas)[K]>;

export interface AnalyticsDispatcherDependencies {
    requestContext: RequestContext;
    subscribers: ReadonlyArray<AnalyticsSubscriber>;
    /** Called once per flush, so lookups are memoized for that flush only. */
    createContext: () => AnalyticsContext;
    options?: AnalyticsDispatchOptions;
}

/**
 * Per-emit overrides, for internal callers such as the deprecated `track` adapter. The storefront-facing helpers take none:
 * the visitor's identity is `session.marketingContext`.
 */
export interface AnalyticsEmitOptions {
    /** Identifies the visitor for this event instead of `session.marketingContext.identifier`. */
    marketingIdentifier?: EventContextSnapshot['marketingIdentifier'];
}

const DEFAULT_CONSENT: AnalyticsConsent = { analytics: true, marketing: true };

/**
 * Marks async work started by a subscriber handler, so emits made from inside a handler are recognised and dropped
 * without affecting emits made concurrently by storefront code.
 */
const insideHandler = new AsyncLocalStorage<true>();

export function eventTypeMatches(pattern: string, type: string): boolean {
    if (pattern === '*') {
        return true;
    }
    if (pattern.endsWith('*')) {
        return type.startsWith(pattern.slice(0, -1));
    }
    return pattern === type;
}

export function isPurposeAllowed(purpose: AnalyticsPurpose, consent: AnalyticsConsent): boolean {
    if (purpose === 'necessary') {
        return true;
    }
    return purpose === 'analytics' ? consent.analytics : consent.marketing;
}

/**
 * Per-request dispatcher internal to analytics: one per built client, never shared between requests.
 *
 * `emit` validates, snapshots request state, enqueues and schedules a flush, and never throws. Delivery is isolated per
 * subscriber: ordered within a subscriber, parallel across subscribers, and one failing subscriber does not affect another.
 * It is not a general purpose event bus.
 */
export class AnalyticsDispatcher {
    private readonly requestContext: RequestContext;
    private readonly subscribers: ReadonlyArray<AnalyticsSubscriber>;
    private readonly createContext: () => AnalyticsContext;
    private readonly options: AnalyticsDispatchOptions;
    private readonly defaultConsent: AnalyticsConsent;

    private queue: AnalyticsEvent[] = [];
    private flushScheduled = false;
    private readonly tails = new Map<AnalyticsSubscriber, Promise<void>>();
    private readonly inflight = new Set<Promise<void>>();

    constructor(dependencies: AnalyticsDispatcherDependencies) {
        this.requestContext = dependencies.requestContext;
        this.createContext = dependencies.createContext;
        this.options = dependencies.options ?? {};
        this.defaultConsent = this.options.defaultConsent ?? DEFAULT_CONSENT;

        const names = new Set<string>();
        for (const subscriber of dependencies.subscribers) {
            AnalyticsSubscriberDescriptorSchema.parse({ name: subscriber.name, types: subscriber.types, purpose: subscriber.purpose });
            if (names.has(subscriber.name)) {
                throw new Error(`Duplicate analytics subscriber name '${subscriber.name}'`);
            }
            names.add(subscriber.name);
        }
        this.subscribers = [...dependencies.subscribers];
    }

    /**
     * Validates the input, captures request state, enqueues the event and schedules delivery.
     * Never throws: invalid input and emits made from inside a subscriber are logged and dropped.
     */
    emit<K extends AnalyticsEventType>(type: K, input: AnalyticsEventInput<K>, options: AnalyticsEmitOptions = {}): Result<AnalyticsEventResult> {
        if (insideHandler.getStore()) {
            console.warn(`Analytics event '${type}' was emitted from inside a subscriber and has been dropped`);
            return error<InvalidInputError>({ type: 'InvalidInput', error: 'Events cannot be emitted from inside an analytics subscriber' });
        }

        try {
            const schema: z.ZodType = AnalyticsEventMutationSchemas[type];
            const mutation = schema.safeParse(input);
            if (!mutation.success) {
                const message = mutation.error.message;
                console.warn(`Analytics event '${type}' had invalid input and has been dropped: ${message}`);
                return error<InvalidInputError>({ type: 'InvalidInput', error: message });
            }

            if (type === 'consent-changed') {
                const change = AnalyticsMutationConsentChangedSchema.parse(input);
                this.requestContext.session.consent = change.consent;
            }

            const { origin, properties, ...payload } = input;
            const event = AnalyticsEventSchema.safeParse({
                id: crypto.randomUUID(),
                type,
                occurredAt: new Date().toISOString(),
                origin,
                properties,
                context: this.snapshot(options),
                payload,
            });
            if (!event.success) {
                console.warn(`Analytics event '${type}' could not be built and has been dropped: ${event.error.message}`);
                return error<InvalidInputError>({ type: 'InvalidInput', error: event.error.message });
            }

            this.queue.push(event.data);
            this.scheduleFlush();
            return success({ eventId: event.data.id });
        } catch (err) {
            console.error(`Analytics event '${type}' failed to enqueue and has been dropped`, err);
            return error<InvalidInputError>({ type: 'InvalidInput', error: err instanceof Error ? err.message : String(err) });
        }
    }

    /**
     * Delivers everything queued so far and resolves once all deliveries, including ones already in flight, are done.
     * For scripts, tests and runtimes without `waitUntil`. Never rejects.
     */
    async flush(): Promise<void> {
        this.deliverQueued();
        await Promise.all([...this.inflight]);
    }

    /**
     * A fresh lookup context, for analytics code that has to resolve something before it can emit (the legacy adapter).
     */
    lookups(): AnalyticsContext {
        return this.createContext();
    }

    private snapshot(options: AnalyticsEmitOptions): EventContextSnapshot {
        const { session, languageContext, referrer, userAgent, clientIp, isBot } = this.requestContext;
        return {
            marketingIdentifier: { ...(options.marketingIdentifier ?? session.marketingContext.identifier) },
            identity: session.identityContext.identity,
            locale: languageContext.locale,
            currency: languageContext.currencyCode,
            consent: session.consent ?? this.defaultConsent,
            page: referrer ? { referrer } : undefined,
            userAgent: userAgent || undefined,
            clientIp: clientIp || undefined,
            isBot,
        };
    }

    private scheduleFlush(): void {
        if (this.flushScheduled) {
            return;
        }
        this.flushScheduled = true;
        const run = Promise.resolve()
            .then(() => {
                this.flushScheduled = false;
                return this.flush();
            })
            .catch((err: unknown) => console.error('Analytics flush failed', err));
        try {
            this.options.waitUntil?.(run);
        } catch (err) {
            console.error('Analytics waitUntil failed', err);
        }
    }

    private deliverQueued(): void {
        const batch = this.queue;
        if (batch.length === 0) {
            return;
        }
        this.queue = [];

        const ctx = this.createContext();
        const deliveries: Promise<void>[] = [];
        for (const subscriber of this.subscribers) {
            const events = batch.filter(
                (event) =>
                    subscriber.types.some((pattern) => eventTypeMatches(pattern, event.type)) &&
                    isPurposeAllowed(subscriber.purpose, event.context.consent ?? this.defaultConsent),
            );
            if (events.length === 0) {
                continue;
            }
            // Chaining on the previous tail keeps per-subscriber order even when flushes overlap.
            const tail = (this.tails.get(subscriber) ?? Promise.resolve()).then(() => this.runSubscriber(subscriber, events, ctx));
            this.tails.set(subscriber, tail);
            deliveries.push(tail);
        }

        const done = Promise.all(deliveries).then(() => undefined);
        this.inflight.add(done);
        void done.finally(() => this.inflight.delete(done));
    }

    private async runSubscriber(subscriber: AnalyticsSubscriber, events: AnalyticsEvent[], ctx: AnalyticsContext): Promise<void> {
        for (const event of events) {
            try {
                const outcome = await insideHandler.run(true, () =>
                    traceSpan(`AnalyticsSubscriber.${subscriber.name}.handle`, () => subscriber.handle(event, ctx)),
                );
                if (outcome === 'rejected') {
                    console.warn(`Analytics subscriber '${subscriber.name}' rejected '${event.type}' (${event.id})`);
                }
            } catch (err) {
                console.error(`Analytics subscriber '${subscriber.name}' failed on '${event.type}' (${event.id})`, err);
            }
        }
    }
}
