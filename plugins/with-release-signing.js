// Expo config plugin: signs the release build with your own keystore when OPENSOUNDS_KEYSTORE is set
// (see scripts/release.sh); otherwise falls back to the debug key so plain `build-apk.sh` keeps working.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARK = '// opensounds-release-signing';

module.exports = (config) =>
  withAppBuildGradle(config, (cfg) => {
    let g = cfg.modResults.contents;
    if (g.includes(MARK)) return cfg;
    g = g.replace(
      /signingConfigs \{\s*debug \{/,
      `signingConfigs {
        ${MARK}
        release {
            if (System.getenv('OPENSOUNDS_KEYSTORE')) {
                storeFile file(System.getenv('OPENSOUNDS_KEYSTORE'))
                storePassword System.getenv('OPENSOUNDS_STORE_PASSWORD')
                keyAlias System.getenv('OPENSOUNDS_KEY_ALIAS') ?: 'opensounds'
                keyPassword System.getenv('OPENSOUNDS_KEY_PASSWORD') ?: System.getenv('OPENSOUNDS_STORE_PASSWORD')
            }
        }
        debug {`,
    );
    g = g.replace(
      /(release \{\s*\/\/ Caution![^\n]*\n[^\n]*\n\s*)signingConfig signingConfigs\.debug/,
      "$1signingConfig System.getenv('OPENSOUNDS_KEYSTORE') ? signingConfigs.release : signingConfigs.debug",
    );
    cfg.modResults.contents = g;
    return cfg;
  });
