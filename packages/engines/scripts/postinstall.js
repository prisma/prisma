const fs = require('fs')
const execa = require('execa')
const path = require('path')

if (fs.existsSync(path.join(__dirname, '../dist/scripts/postinstall.js'))) {
  require(path.join(__dirname, '../dist/scripts/postinstall.js'))
} else {
  void execa('node', ['-r', 'esbuild-register', path.join(__dirname, '../src/scripts/postinstall.ts')], {
    stdio: 'inherit',
  })
}
