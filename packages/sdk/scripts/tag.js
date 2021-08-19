const { getLatestTag } = require('@prisma/fetch-engine')

getLatestTag().then(console.log)
