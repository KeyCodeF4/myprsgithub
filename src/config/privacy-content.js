// Single source of truth for the privacy policy shown in-app.
//
// IMPORTANT: keep this in step with the App Privacy answers in App Store Connect
// and the Data Safety form in Google Play Console. Mismatches between the policy
// and those forms are a common rejection reason.
//
// The matching public page lives in public/privacy/index.html and is exported
// with the web build. Keep both copies aligned before each store submission.

export const SUPPORT_EMAIL = 'support@myprs.app';
export const POLICY_URL = 'https://myprs.expo.app/privacy/';
export const PRIVACY_LAST_UPDATED = '31 July 2026';

export const PRIVACY_POLICY = [
  {
    heading: 'The short version',
    body: [
      'MyPRS is built to work entirely on your phone. Your workouts are stored locally and are not sent anywhere unless you choose to create an account for backup.',
      'We do not sell your data, we do not run advertising, and we do not share your workout history with third parties.',
    ],
  },
  {
    heading: 'What stays on your device',
    body: ['By default, everything below is stored only in the app\'s local storage on your phone:'],
    bullets: [
      'Workouts you log — exercises, weights, reps, sets and durations',
      'Wrapped cards, medals, titles, XP and level',
      'App preferences such as your theme, sound and reminder settings',
    ],
  },
  {
    heading: 'What we store if you create an account',
    body: [
      'An account is optional and exists only so your progress survives losing or changing your phone. If you create one, we store:',
    ],
    bullets: [
      'Your email address, used to sign you in and nothing else',
      'A copy of your workouts, Wrapped cards, medals and XP so they can be restored',
      'The date of your most recent backup',
    ],
  },
  {
    heading: 'Notifications',
    body: [
      'The daily reminder is off by default. If you turn it on, we ask your device for notification permission and schedule the reminder locally on your phone. Turning the reminder off cancels it. We do not use notifications for marketing.',
    ],
  },
  {
    heading: 'Crash and error reporting',
    body: [
      'To find and fix bugs we send crash reports to Sentry, our error-reporting provider. These contain the error, the screen or action it happened in, and device/OS information.',
      'Crash reports are deliberately scrubbed: they never include your email, workout contents, exercise names, weights or titles.',
    ],
  },
  {
    heading: 'Optional usage analytics',
    body: [
      'If you are signed in, you can choose to share anonymous product events that help us understand whether onboarding, workout logging, Wrapped creation and collection features are working well.',
      'This is off by default. Events use a random installation identifier and never include your email, exercise names, weights, reps, titles or workout contents. You can turn it off at any time from the Account screen.',
    ],
  },
  {
    heading: 'Sharing a Wrapped card',
    body: [
      'When you share a Wrapped card, the image is created on your device and handed to whichever app you pick. We do not upload it or keep a copy.',
    ],
  },
  {
    heading: 'Your choices and rights',
    body: ['You are in control of your data at all times:'],
    bullets: [
      'Use the app with no account and nothing ever leaves your device',
      'Back up automatically after account creation and restore on demand from the Account screen',
      'Delete your account and all backed-up data from the Account screen — this is immediate and permanent',
      'Uninstalling the app removes all locally stored data',
      'Email us to request a copy of, or the deletion of, anything we hold',
    ],
  },
  {
    heading: 'Children',
    body: [
      'MyPRS is not directed at children under 13, and we do not knowingly collect data from them. If you believe a child has created an account, contact us and we will delete it.',
    ],
  },
  {
    heading: 'Changes to this policy',
    body: [
      'If this policy changes in a way that affects how your data is handled, we will update the date at the top and highlight the change in the app.',
    ],
  },
];

// Convenience summary matching the store data-safety questionnaires.
export const DATA_DISCLOSURE = {
  collected: [
    { type: 'Email address', purpose: 'Account sign-in', linkedToUser: true, optional: true },
    { type: 'Fitness / workout data', purpose: 'Cloud backup and restore', linkedToUser: true, optional: true },
    { type: 'Crash and diagnostic data', purpose: 'App stability', linkedToUser: false, optional: false },
    { type: 'Product interaction data', purpose: 'App improvement', linkedToUser: false, optional: true },
  ],
  notCollected: ['Location', 'Contacts', 'Advertising identifiers', 'Browsing history', 'Payment info'],
  sold: false,
  usedForTracking: false,
};
