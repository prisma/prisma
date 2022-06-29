const fs = require('fs')
const path = require('path')

// that's the normal path, when users get this package ready/installed
if (fs.existsSync(path.join(__dirname, '../dist/scripts/postinstall.js'))) {
  require(path.join(__dirname, '../dist/scripts/postinstall.js'))
} else {
  // that's when we develop in the monorepo, `dist` does not exist yet
  // so we compile postinstall script and trigger it immediately after

  const execa = require('execa')
  void execa.sync('node', ['-r', 'esbuild-register', path.join(__dirname, '../helpers/build.ts')], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
    env: {
      DEV: true,
    },
  })

  require(path.join(__dirname, '../dist/scripts/postinstall.js'))
}
