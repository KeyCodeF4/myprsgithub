const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Reanimated's Worklets native module fails to initialize under Expo's
// default Metro config (inlineRequires disabled) — this is required for
// the Worklets runtime to register correctly, notably in Expo Go.
config.transformer.getTransformOptions = async () => ({
  transform: {
    inlineRequires: true,
  },
});

module.exports = config;
