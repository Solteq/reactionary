import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { NoPreloading, provideRouter, withPreloading, withRouterConfig } from '@angular/router';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(
      appRoutes,
      withPreloading(NoPreloading),
      withRouterConfig({
        onSameUrlNavigation: 'ignore'
      })
    )
  ],
};
