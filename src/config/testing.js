// Temporary testing switch. Keep this behind an environment flag so the
// production release check can prevent Developer Tools shipping by accident.
export const TESTING_TOOLS_ENABLED = __DEV__
  || process.env.EXPO_PUBLIC_ENABLE_TEST_TOOLS === 'true';
