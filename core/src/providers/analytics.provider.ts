import { BaseProvider } from './base.provider.js';

export abstract class AnalyticsProvider extends BaseProvider {
  protected override getResourceName(): string {
    return 'analytics';
  }
}
