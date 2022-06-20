#!/usr/bin/env node

const path = require('path')
const { getPackedPackage } = require('@prisma/internals')

async function main() {
  const target = path.join(process.cwd(), './node_modules/@prisma/client')
  await getPackedPackage('@prisma/client', target, path.join(__dirname, '../'))
  console.log(`Saving packed client to ${target}`)
}

main()
