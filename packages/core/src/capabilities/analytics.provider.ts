import type { AnalyticsContext } from '../analytics/context.js';
import type { AnalyticsSubscriber } from '../analytics/dispatcher.js';
import type { AnalyticsEvent, AnalyticsEventType, AnalyticsOutcome, AnalyticsPurpose } from '../schemas/index.js';
import { BaseCapability } from './base.capability.js';

/**
 * Base class for vendor analytics integrations (Unomi, Algolia, Google Analytics, ...).
 *
 * Providers are not called by the storefront. The `ClientBuilder` registers them as subscribers of the client's
 * per-request dispatcher, which hands them events together with a read-only {@link AnalyticsContext} to enrich from.
 */
export abstract class AnalyticsProvider extends BaseCapability implements AnalyticsSubscriber {
  /** Unique within a client. Used in logs and tracing. Defaults to the resource name. */
  public get name(): string {
    return this.getResourceName();
  }

  /** Event types handled: exact types, prefix wildcards such as `cart-*`, or `*`. */
  public abstract readonly types: ReadonlyArray<AnalyticsEventType | `${string}*`>;

  /** What the provider uses events for. The dispatcher skips providers whose purpose lacks consent. */
  public abstract readonly purpose: AnalyticsPurpose;

  /**
   * Handles one event. Throwing is safe: the dispatcher isolates failures per provider.
   * Degrade by sending fewer fields when a lookup on `ctx` fails; do not drop the event for that.
   */
  public abstract handle(event: AnalyticsEvent, ctx: AnalyticsContext): Promise<AnalyticsOutcome | void>;

  protected override getResourceName(): string {
    return 'analytics';
  }
}
