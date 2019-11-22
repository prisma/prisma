const { getPackedPackage } = require('@prisma/sdk')
const path = require('path')

getPackedPackage('@prisma/photon', path.join(__dirname, '../photon'))
