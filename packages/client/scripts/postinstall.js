const fs = require('fs')

// it won't be found when the monorepo just installed
// and that is fine because this runs prisma generate
// prisma generate should not be run in the monorepo
if (fs.existsSync('../dist/scripts/postinstall.js')) {
  require('../dist/scripts/postinstall.js')
}
