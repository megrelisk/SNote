/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'SNoteWidgets',
  displayName: 'SNote',
  // "<app bundle id>.widgets" — SharedStore.swift derives the App Group from this.
  bundleIdentifier: '.widgets',
  icon: '../../assets/icon.png',
  // Interactive widgets (Button(intent:)) and AppIntentConfiguration need iOS 17.
  deploymentTarget: '17.0',
  colors: {
    $accent: { color: '#2F6FEB', darkColor: '#5B8DEF' },
    $widgetBackground: { color: '#FFFFFF', darkColor: '#1C1C1E' },
    cardBackground: { color: '#F4F4F1', darkColor: '#2C2C2E' },
  },
  entitlements: {
    // Same App Group as the app (written by modules/snote-widgets).
    'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'],
  },
});
