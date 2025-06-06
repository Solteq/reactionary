import { AnalyticsEvent, AnalyticsProvider, Session } from '@reactionary/core';
import { PosthogConfiguration } from '../schema/configuration.schema';
import { PostHog } from 'posthog-node';

export class PosthogAnalyticsProvider implements AnalyticsProvider {
  protected config: PosthogConfiguration;
  protected client: PostHog;

  constructor(config: PosthogConfiguration) {
    this.config = config;

    this.client = new PostHog(this.config.apiKey, { host: this.config.host });
  }

  publish(event: AnalyticsEvent, session: Session): void {
    this.client.capture({
      distinctId: session.identity.id || session.id,
      event: event.type,
      properties: event,
    });
  }

  shutdown(): Promise<void> {
    return this.client.shutdown(5000);
  }
}
