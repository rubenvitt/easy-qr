import { handleErrorWithSentry } from '@sentry/sveltekit';
import * as Sentry from '@sentry/sveltekit';
import { dev } from '$app/environment';

declare const __PUBLIC_SENTRY_DSN__: string;

if (__PUBLIC_SENTRY_DSN__) {
  Sentry.init({
    dsn: __PUBLIC_SENTRY_DSN__,
    environment: dev ? 'development' : 'production',
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0
  });
}

export const handleError = handleErrorWithSentry();
