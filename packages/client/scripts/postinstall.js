const fs = require('fs')

// it won't be found when the monorepo just installed
if (fs.existsSync('../dist/scripts/postinstall.js')) {
  require('../dist/scripts/postinstall.js')
}
