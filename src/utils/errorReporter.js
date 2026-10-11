import * as Sentry from '@sentry/react-native';

// Crash/error reporting is opt-in via env so local dev and CI stay quiet and no
// DSN is baked into the repo. Set EXPO_PUBLIC_SENTRY_DSN in EAS build secrets.
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
let initialised = false;

// Workout data is personal. We deliberately send only the failure context, never
// exercise names, weights, titles, emails or auth tokens.
const SAFE_DETAIL_KEYS = ['table', 'type', 'format', 'platform', 'count', 'periodKey', 'cardType'];

function scrubDetails(details) {
  const safe = {};
  for (const key of SAFE_DETAIL_KEYS) {
    if (details && details[key] !== undefined) safe[key] = details[key];
  }
  return safe;
}

export function initErrorReporting() {
  if (initialised || !DSN) return false;
  try {
    Sentry.init({
      dsn: DSN,
      // Errors only by default — performance tracing on a fitness app adds cost
      // without telling us much about crashes.
      tracesSampleRate: 0,
      // Breadcrumbs can capture typed text; workout entry is personal data.
      maxBreadcrumbs: 30,
      sendDefaultPii: false,
      beforeSend(event) {
        // Belt and braces: strip anything that could carry a user identifier.
        if (event.user) delete event.user;
        if (event.request) delete event.request;
        return event;
      },
    });
    initialised = true;
    return true;
  } catch (error) {
    console.error('[MyPRS:sentry-init]', error?.message);
    return false;
  }
}

/**
 * Single reporting seam used across the app. Always logs locally; additionally
 * forwards to Sentry once initialised.
 */
export function reportError(error, context, details = {}) {
  const normalized = error instanceof Error ? error : new Error(String(error || 'Unknown error'));
  console.error(`[MyPRS:${context}]`, normalized.message, details);

  if (initialised) {
    try {
      Sentry.captureException(normalized, {
        tags: { context },
        extra: scrubDetails(details),
      });
    } catch (sendError) {
      console.error('[MyPRS:sentry-send]', sendError?.message);
    }
  }

  return normalized;
}

/** Non-fatal signal (e.g. a degraded path we recovered from). */
export function reportMessage(message, context) {
  if (!initialised) return;
  try {
    Sentry.captureMessage(message, { level: 'warning', tags: { context } });
  } catch (error) {
    console.error('[MyPRS:sentry-message]', error?.message);
  }
}

export function getFriendlyError(error, fallback = 'Something went wrong. Please try again.') {
  if (error?.code === 'NETWORK_ERROR') return 'You appear to be offline. Your workout is still safe on this device.';
  return fallback;
}
