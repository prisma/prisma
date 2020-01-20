const { getPackedPackage } = require('@prisma/sdk')
const path = require('path')

getPackedPackage('@prisma/client', path.join(__dirname, '../prisma-client'))
