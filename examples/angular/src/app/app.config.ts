import { ApplicationConfig, provideExperimentalZonelessChangeDetection } from '@angular/core';
import { NoPreloading, provideRouter, withPreloading, withRouterConfig } from '@angular/router';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideExperimentalZonelessChangeDetection(),
    provideRouter(
      appRoutes,
      withPreloading(NoPreloading),
      withRouterConfig({
        onSameUrlNavigation: 'ignore'
      })
    )
  ],
};
