const { PrismaClient } = require('@prisma/client')
const assert = require('assert')

let res
const prisma = new PrismaClient()
async function main() {
  res = prisma.user.findMany()
}

module.exports = () => {
  return new Promise((r) => {
    main().finally(async () => {
      await prisma.$disconnect()
      r(await res)
    })
  })
}

if (require.main === module) {
  module.exports()
}
