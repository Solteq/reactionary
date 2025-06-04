import { AnalyticsEvent } from '../schemas/analytics.schema';
import { Session } from '../schemas/session.schema';
import { AnalyticsProvider } from '../providers/analytics.provider';

export class Analytics {
  protected providers: Array<AnalyticsProvider>;

  constructor(providers: Array<AnalyticsProvider>) {
    this.providers = providers;
  }

  public publish(event: AnalyticsEvent, session: Session) {
    for (const provider of this.providers) {
      provider.publish(event, session);
    }
  }

  public async shutdown() {
    const pending = [];

    for (const provider of this.providers) {
      pending.push(provider.shutdown());
    }

    await Promise.all(pending);    
  }
}
