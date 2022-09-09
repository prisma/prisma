const path = require('path')

const postInstallScriptPath = path.join(__dirname, '..', 'dist', 'scripts', 'postinstall.js')
const localInstallScriptPath = path.join(__dirname, '..', 'dist', 'scripts', 'localinstall.js')

try {
  // that's when we develop in the monorepo, `dist` does not exist yet
  // so we compile postinstall script and trigger it immediately after
  if (require('../package.json').version === '0.0.0') {
    const execa = require('execa')
    const buildScriptPath = path.join(__dirname, '..', 'helpers', 'build.ts')

    execa.sync('node', ['-r', 'esbuild-register', buildScriptPath], {
      env: { DEV: true },
    })

    require(localInstallScriptPath) // may install engines overrides
  }
} catch {}

// that's the normal path, when users get this package ready/installed
require(postInstallScriptPath)
