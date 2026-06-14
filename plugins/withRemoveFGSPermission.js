const { withAndroidManifest } = require('@expo/config-plugins');

const BLOCKED = [
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
];

module.exports = (config) =>
  withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    if (manifest['uses-permission']) {
      manifest['uses-permission'] = manifest['uses-permission'].filter(
        (p) => !BLOCKED.includes(p.$?.['android:name'])
      );
    }
    return mod;
  });
