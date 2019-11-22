#!/usr/bin/env node

const path = require('path')
const { getPackedPackage } = require('@prisma/sdk')

async function main() {
  const target = path.join(process.cwd(), './node_modules/@prisma/photon')
  await getPackedPackage('@prisma/photon', target, path.join(__dirname, '../'))
  console.log(`Saving packed photon to ${target}`)
}

main()
