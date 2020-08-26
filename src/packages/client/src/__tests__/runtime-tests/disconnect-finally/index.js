const { PrismaClient } = require('@prisma/client')
const assert = require('assert')

let res
const prisma = new PrismaClient()
async function main() {
  res = prisma.user.findMany()
}

module.exports = () => {
  return new Promise((resolve) => {
    main().finally(async () => {
      await prisma.$disconnect()
      resolve(await res)
    })
  })
}

if (require.main === module) {
  module.exports()
}
