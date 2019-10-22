const { download } = require('@prisma/fetch-engine')
const path = require('path')
download({
  binaries: { 'migration-engine': path.join(__dirname, '../') },
  // version: '19ed9db8b704a89eef6fe710fa52c2ad0493443f',
})
