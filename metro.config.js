const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Fix: zustand v5 ESM builds use import.meta.env which is invalid outside ES modules.
// Remove 'import' condition so Metro resolves CJS builds (index.js) instead of ESM (.mjs).
config.resolver.unstable_conditionNames = ['browser', 'require', 'default'];

module.exports = config;
