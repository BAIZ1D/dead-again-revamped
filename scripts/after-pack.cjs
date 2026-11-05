const { execSync } = require('child_process');
const path = require('path');

exports.default = async function (context) {
  if (context.electronPlatformName === 'darwin') {
    // When packaging universal, electron-builder creates temporary intermediate directories
    // ending with '-temp' (e.g. mac-universal-x64-temp and mac-universal-arm64-temp).
    // Intermediate slices MUST NOT be signed because @electron/universal requires all non-binary
    // files (including _CodeSignature/CodeResources) to have identical SHA checksums.
    if (context.appOutDir.endsWith('-temp') || context.appOutDir.includes('-temp')) {
      console.log(`[afterPack] Skipping intermediate slice (${context.appOutDir}) to preserve matching SHAs for universal merge.`);
      return;
    }

    const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
    console.log(`[afterPack] Applying clean ad-hoc signature to macOS app: ${appPath}`);
    try {
      execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' });
      console.log('[afterPack] Successfully signed macOS app bundle with ad-hoc signature.');
    } catch (err) {
      console.warn('[afterPack] Warning: ad-hoc signing failed:', err.message);
    }
  }
};
