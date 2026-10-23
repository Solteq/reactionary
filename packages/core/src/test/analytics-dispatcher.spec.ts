import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialRequestContext } from '../initialization.js';
import {
  AnalyticsDispatcher,
  RecordingAnalyticsSubscriber,
  createAnalyticsContext,
  eventTypeMatches,
  fromSearch,
  isPurposeAllowed,
  productKey,
} from '../index.js';
import type { AnalyticsContext, AnalyticsDispatchOptions, AnalyticsSubscriber, RequestContext } from '../index.js';

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function setup(subscribers: AnalyticsSubscriber[], options?: AnalyticsDispatchOptions, requestContext: RequestContext = createInitialRequestContext()) {
  const createContext = vi.fn(() => createAnalyticsContext({ capabilities: {}, requestContext }));
  const dispatcher = new AnalyticsDispatcher({ requestContext, subscribers, createContext, options });
  return { dispatcher, requestContext, createContext };
}

const viewed = (key: string) => ({ product: { key } });

describe('AnalyticsDispatcher', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('emit', () => {
    it('returns the event id immediately and delivers on flush', async () => {
      const recorder = new RecordingAnalyticsSubscriber();
      const { dispatcher } = setup([recorder]);

      const result = dispatcher.emit('product-viewed', viewed('p1'));

      expect(result.success).toBe(true);
      expect(recorder.events).toHaveLength(0);
      await dispatcher.flush();
      expect(recorder.events).toHaveLength(1);
      expect(result.success && result.value.eventId).toBe(recorder.events[0].id);
    });

    it('builds the envelope with origin, properties and context', async () => {
      const recorder = new RecordingAnalyticsSubscriber();
      const requestContext = createInitialRequestContext();
      requestContext.session.marketingContext.identifier.key = 'visitor-1';
      requestContext.referrer = 'https://example.com/';
      const { dispatcher } = setup([recorder], undefined, requestContext);
      const origin = fromSearch({ term: 'drill', facets: [], filters: [], paginationOptions: { pageNumber: 1, pageSize: 20 } }, 3);

      dispatcher.emit('product-clicked', { product: { key: 'p1' }, origin, properties: { variant: 'b' } });
      await dispatcher.flush();

      const [event] = recorder.events;
      expect(event.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(new Date(event.occurredAt).toISOString()).toBe(event.occurredAt);
      expect(event).toMatchObject({
        type: 'product-clicked',
        payload: { product: { key: 'p1' } },
        origin: { type: 'search', position: 3 },
        properties: { variant: 'b' },
        context: {
          marketingIdentifier: { key: 'visitor-1' },
          identity: { type: 'Anonymous' },
          locale: requestContext.languageContext.locale,
          currency: requestContext.languageContext.currencyCode,
          consent: { analytics: true, marketing: true },
          page: { referrer: 'https://example.com/' },
        },
      });
    });

    it('captures request state at emit time, not at dispatch time', async () => {
      const recorder = new RecordingAnalyticsSubscriber();
      const { dispatcher, requestContext } = setup([recorder]);
      requestContext.session.marketingContext.identifier.key = 'before';

      dispatcher.emit('product-viewed', viewed('p1'));
      requestContext.session.marketingContext.identifier.key = 'after';
      requestContext.session.identityContext.identity = { type: 'Registered', id: { userId: 'u1' } };
      await dispatcher.flush();

      expect(recorder.events[0].context.marketingIdentifier.key).toBe('before');
      expect(recorder.events[0].context.identity.type).toBe('Anonymous');
    });

    it('captures user agent, ip and bot flag at emit time, and leaves out empty values', async () => {
      const recorder = new RecordingAnalyticsSubscriber();
      const requestContext = createInitialRequestContext();
      requestContext.userAgent = 'Mozilla/5.0';
      requestContext.clientIp = '203.0.113.7';
      requestContext.isBot = true;
      const { dispatcher } = setup([recorder], undefined, requestContext);

      dispatcher.emit('product-viewed', viewed('p1'));
      requestContext.userAgent = 'changed';
      requestContext.isBot = false;
      await dispatcher.flush();

      expect(recorder.events[0].context).toMatchObject({ userAgent: 'Mozilla/5.0', clientIp: '203.0.113.7', isBot: true });

      const empty = new RecordingAnalyticsSubscriber();
      const second = setup([empty]);
      second.dispatcher.emit('product-viewed', viewed('p1'));
      await second.dispatcher.flush();
      expect(empty.events[0].context.userAgent).toBeUndefined();
      expect(empty.events[0].context.clientIp).toBeUndefined();
      expect(empty.events[0].context.isBot).toBe(false);
    });

    it('captures the session id at emit time, and leaves it out when the session has none', async () => {
      const recorder = new RecordingAnalyticsSubscriber();
      const requestContext = createInitialRequestContext();
      requestContext.session.id = 'session-1';
      const { dispatcher } = setup([recorder], undefined, requestContext);

      dispatcher.emit('product-viewed', viewed('p1'));
      requestContext.session.id = 'session-2';
      await dispatcher.flush();

      expect(recorder.events[0].context.sessionId).toBe('session-1');

      const empty = new RecordingAnalyticsSubscriber();
      const second = setup([empty]);
      second.dispatcher.emit('product-viewed', viewed('p1'));
      await second.dispatcher.flush();
      expect(empty.events[0].context.sessionId).toBeUndefined();
    });

    it('lets an internal caller override the visitor identifier for one event only', async () => {
      const recorder = new RecordingAnalyticsSubscriber();
      const { dispatcher, requestContext } = setup([recorder]);
      requestContext.session.marketingContext.identifier.key = 'session-visitor';

      dispatcher.emit('product-viewed', viewed('p1'), { marketingIdentifier: { key: 'explicit-visitor' } });
      dispatcher.emit('product-viewed', viewed('p2'));
      await dispatcher.flush();

      expect(recorder.events.map((e) => e.context.marketingIdentifier.key)).toEqual(['explicit-visitor', 'session-visitor']);
      expect(requestContext.session.marketingContext.identifier.key).toBe('session-visitor');
    });

    it('never throws on invalid input, and drops the event', async () => {
      const recorder = new RecordingAnalyticsSubscriber();
      const { dispatcher } = setup([recorder]);

      // @ts-expect-error product needs a key
      const result = dispatcher.emit('product-viewed', { product: {} });
      await dispatcher.flush();

      expect(result.success).toBe(false);
      expect(recorder.events).toHaveLength(0);
      expect(console.warn).toHaveBeenCalled();
    });

    it('hands the delivery promise to waitUntil', async () => {
      const recorder = new RecordingAnalyticsSubscriber();
      const waitUntil = vi.fn<(promise: Promise<unknown>) => void>();
      const { dispatcher } = setup([recorder], { waitUntil });

      dispatcher.emit('product-viewed', viewed('p1'));
      dispatcher.emit('product-viewed', viewed('p2'));

      expect(waitUntil).toHaveBeenCalledTimes(1);
      await waitUntil.mock.calls[0][0];
      expect(recorder.events).toHaveLength(2);
    });

    it('delivers without waitUntil too (fire and forget)', async () => {
      const recorder = new RecordingAnalyticsSubscriber();
      const { dispatcher } = setup([recorder]);

      dispatcher.emit('product-viewed', viewed('p1'));
      await tick();

      expect(recorder.events).toHaveLength(1);
    });
  });

  describe('delivery', () => {
    it('keeps emit order per subscriber and runs subscribers in parallel', async () => {
      const slowGate = gate();
      const slowSeen: string[] = [];
      const slow: AnalyticsSubscriber = {
        name: 'slow',
        types: ['*'],
        purpose: 'necessary',
        async handle(event) {
          if (event.type !== 'product-viewed') return;
          if (productKey(event.payload.product) === 'p1') await slowGate.promise;
          slowSeen.push(productKey(event.payload.product));
        },
      };
      const fast = new RecordingAnalyticsSubscriber('fast');
      const { dispatcher } = setup([slow, fast]);

      dispatcher.emit('product-viewed', viewed('p1'));
      dispatcher.emit('product-viewed', viewed('p2'));
      const flushing = dispatcher.flush();
      await tick();

      expect(fast.events).toHaveLength(2);
      expect(slowSeen).toEqual([]);

      slowGate.release();
      await flushing;
      expect(slowSeen).toEqual(['p1', 'p2']);
    });

    it('keeps order across overlapping flushes', async () => {
      const first = gate();
      const seen: string[] = [];
      const subscriber: AnalyticsSubscriber = {
        name: 'ordered',
        types: ['*'],
        purpose: 'necessary',
        async handle(event) {
          if (event.type !== 'product-viewed') return;
          if (productKey(event.payload.product) === 'p1') await first.promise;
          seen.push(productKey(event.payload.product));
        },
      };
      const { dispatcher } = setup([subscriber]);

      dispatcher.emit('product-viewed', viewed('p1'));
      const firstFlush = dispatcher.flush();
      dispatcher.emit('product-viewed', viewed('p2'));
      const secondFlush = dispatcher.flush();
      first.release();
      await Promise.all([firstFlush, secondFlush]);

      expect(seen).toEqual(['p1', 'p2']);
    });

    it('isolates a failing subscriber from the others and never rejects', async () => {
      const failing: AnalyticsSubscriber = {
        name: 'failing',
        types: ['*'],
        purpose: 'necessary',
        async handle() {
          throw new Error('vendor down');
        },
      };
      const healthy = new RecordingAnalyticsSubscriber('healthy');
      const { dispatcher } = setup([failing, healthy]);

      dispatcher.emit('product-viewed', viewed('p1'));
      dispatcher.emit('product-viewed', viewed('p2'));
      await expect(dispatcher.flush()).resolves.toBeUndefined();

      expect(healthy.events).toHaveLength(2);
      expect(console.error).toHaveBeenCalledTimes(2);
    });

    it('keeps delivering later events to a subscriber after one of them failed', async () => {
      const seen: string[] = [];
      const flaky: AnalyticsSubscriber = {
        name: 'flaky',
        types: ['*'],
        purpose: 'necessary',
        async handle(event) {
          if (event.type !== 'product-viewed') return;
          if (productKey(event.payload.product) === 'p1') throw new Error('boom');
          seen.push(productKey(event.payload.product));
        },
      };
      const { dispatcher } = setup([flaky]);

      dispatcher.emit('product-viewed', viewed('p1'));
      dispatcher.emit('product-viewed', viewed('p2'));
      await dispatcher.flush();

      expect(seen).toEqual(['p2']);
    });

    it('creates one lookup context per flush and shares it between handlers', async () => {
      const a = new RecordingAnalyticsSubscriber('a');
      const b = new RecordingAnalyticsSubscriber('b');
      const { dispatcher, createContext } = setup([a, b]);

      dispatcher.emit('product-viewed', viewed('p1'));
      dispatcher.emit('product-viewed', viewed('p2'));
      await dispatcher.flush();
      expect(createContext).toHaveBeenCalledTimes(1);
      expect(a.contexts[0]).toBe(b.contexts[0]);

      dispatcher.emit('product-viewed', viewed('p3'));
      await dispatcher.flush();
      expect(createContext).toHaveBeenCalledTimes(2);
      expect(a.contexts[1]).not.toBe(a.contexts[0]);
    });
  });

  describe('type matching', () => {
    it('supports exact types, prefix wildcards and *', async () => {
      const exact = new RecordingAnalyticsSubscriber('exact', ['product-viewed']);
      const prefix = new RecordingAnalyticsSubscriber('prefix', ['product-*']);
      const all = new RecordingAnalyticsSubscriber('all', ['*']);
      const none = new RecordingAnalyticsSubscriber('none', ['cart-*']);
      const { dispatcher } = setup([exact, prefix, all, none]);

      dispatcher.emit('product-viewed', viewed('p1'));
      dispatcher.emit('product-clicked', { product: { key: 'p1' } });
      dispatcher.emit('custom', { name: 'x', payload: {} });
      await dispatcher.flush();

      expect(exact.events.map((e) => e.type)).toEqual(['product-viewed']);
      expect(prefix.events.map((e) => e.type)).toEqual(['product-viewed', 'product-clicked']);
      expect(all.events).toHaveLength(3);
      expect(none.events).toHaveLength(0);
    });

    it('matches patterns', () => {
      expect(eventTypeMatches('*', 'anything')).toBe(true);
      expect(eventTypeMatches('cart-*', 'cart-viewed')).toBe(true);
      expect(eventTypeMatches('cart-*', 'checkout-started')).toBe(false);
      expect(eventTypeMatches('cart-viewed', 'cart-viewed')).toBe(true);
      expect(eventTypeMatches('cart-viewed', 'cart-viewed-twice')).toBe(false);
    });
  });

  describe('consent gating', () => {
    const subscribers = () => ({
      necessary: new RecordingAnalyticsSubscriber('necessary', ['*'], 'necessary'),
      analytics: new RecordingAnalyticsSubscriber('analytics', ['*'], 'analytics'),
      marketing: new RecordingAnalyticsSubscriber('marketing', ['*'], 'marketing'),
    });

    it('skips subscribers whose purpose is not granted', async () => {
      const s = subscribers();
      const requestContext = createInitialRequestContext();
      requestContext.session.consent = { analytics: false, marketing: true };
      const { dispatcher } = setup([s.necessary, s.analytics, s.marketing], undefined, requestContext);

      dispatcher.emit('product-viewed', viewed('p1'));
      await dispatcher.flush();

      expect(s.necessary.events).toHaveLength(1);
      expect(s.analytics.events).toHaveLength(0);
      expect(s.marketing.events).toHaveLength(1);
    });

    it('defaults to everything granted when the session carries no consent', async () => {
      const s = subscribers();
      const { dispatcher } = setup([s.necessary, s.analytics, s.marketing]);

      dispatcher.emit('product-viewed', viewed('p1'));
      await dispatcher.flush();

      expect([s.necessary, s.analytics, s.marketing].map((x) => x.events.length)).toEqual([1, 1, 1]);
    });

    it('uses the configured default when the session carries no consent', async () => {
      const s = subscribers();
      const { dispatcher } = setup([s.necessary, s.analytics, s.marketing], { defaultConsent: { analytics: false, marketing: false } });

      dispatcher.emit('product-viewed', viewed('p1'));
      await dispatcher.flush();

      expect([s.necessary, s.analytics, s.marketing].map((x) => x.events.length)).toEqual([1, 0, 0]);
    });

    it('lets session consent override the configured default', async () => {
      const s = subscribers();
      const requestContext = createInitialRequestContext();
      requestContext.session.consent = { analytics: true, marketing: false };
      const { dispatcher } = setup([s.analytics, s.marketing], { defaultConsent: { analytics: false, marketing: true } }, requestContext);

      dispatcher.emit('product-viewed', viewed('p1'));
      await dispatcher.flush();

      expect([s.analytics, s.marketing].map((x) => x.events.length)).toEqual([1, 0]);
    });

    it('applies consent-changed to later events and to the consent-changed event itself', async () => {
      const s = subscribers();
      const { dispatcher, requestContext } = setup([s.necessary, s.analytics]);

      dispatcher.emit('product-viewed', viewed('before'));
      dispatcher.emit('consent-changed', { consent: { analytics: false, marketing: false } });
      dispatcher.emit('product-viewed', viewed('after'));
      await dispatcher.flush();

      expect(requestContext.session.consent).toEqual({ analytics: false, marketing: false });
      expect(s.analytics.events.map((e) => e.type)).toEqual(['product-viewed']);
      expect(s.necessary.events.map((e) => e.type)).toEqual(['product-viewed', 'consent-changed', 'product-viewed']);
    });

    it('allows necessary always', () => {
      expect(isPurposeAllowed('necessary', { analytics: false, marketing: false })).toBe(true);
      expect(isPurposeAllowed('analytics', { analytics: false, marketing: true })).toBe(false);
      expect(isPurposeAllowed('marketing', { analytics: false, marketing: true })).toBe(true);
    });
  });

  describe('loop guard', () => {
    it('drops events emitted from inside a subscriber', async () => {
      const recorder = new RecordingAnalyticsSubscriber('recorder');
      const holder: { dispatcher?: AnalyticsDispatcher; reentrant?: boolean } = {};
      const reentrant: AnalyticsSubscriber = {
        name: 'reentrant',
        types: ['product-viewed'],
        purpose: 'necessary',
        async handle() {
          await tick();
          const result = holder.dispatcher?.emit('product-clicked', { product: { key: 'loop' } });
          holder.reentrant = result?.success;
        },
      };
      const { dispatcher } = setup([reentrant, recorder]);
      holder.dispatcher = dispatcher;

      dispatcher.emit('product-viewed', viewed('p1'));
      await dispatcher.flush();

      expect(holder.reentrant).toBe(false);
      expect(recorder.events.map((e) => e.type)).toEqual(['product-viewed']);
      expect(console.warn).toHaveBeenCalled();
    });

    it('does not drop emits made by storefront code while a flush is running', async () => {
      const blocker = gate();
      const slow: AnalyticsSubscriber = {
        name: 'slow',
        types: ['*'],
        purpose: 'necessary',
        async handle() {
          await blocker.promise;
        },
      };
      const recorder = new RecordingAnalyticsSubscriber('recorder');
      const { dispatcher } = setup([slow, recorder]);

      dispatcher.emit('product-viewed', viewed('p1'));
      const flushing = dispatcher.flush();
      await tick();
      const late = dispatcher.emit('product-viewed', viewed('p2'));
      blocker.release();
      await flushing;
      await dispatcher.flush();

      expect(late.success).toBe(true);
      expect(recorder.eventsOfType('product-viewed').map((e) => productKey(e.payload.product))).toEqual(['p1', 'p2']);
    });
  });

  describe('construction', () => {
    it('rejects duplicate subscriber names and invalid descriptors', () => {
      const a = new RecordingAnalyticsSubscriber('same');
      const b = new RecordingAnalyticsSubscriber('same');
      const empty = new RecordingAnalyticsSubscriber('empty', []);

      expect(() => setup([a, b])).toThrow(/Duplicate/);
      expect(() => setup([empty])).toThrow();
    });

    it('is a no-op to flush with nothing queued', async () => {
      const { dispatcher, createContext } = setup([new RecordingAnalyticsSubscriber()]);

      await dispatcher.flush();

      expect(createContext).not.toHaveBeenCalled();
    });
  });
});

describe('AnalyticsContext handed to subscribers', () => {
  it('is the object the factory produced', async () => {
    const recorder = new RecordingAnalyticsSubscriber();
    const requestContext = createInitialRequestContext();
    const context: AnalyticsContext = createAnalyticsContext({ capabilities: {}, requestContext });
    const dispatcher = new AnalyticsDispatcher({ requestContext, subscribers: [recorder], createContext: () => context });

    dispatcher.emit('product-viewed', viewed('p1'));
    await dispatcher.flush();

    expect(recorder.contexts[0]).toBe(context);
  });
});
