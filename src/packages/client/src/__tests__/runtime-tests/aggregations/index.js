const { PrismaClient } = require('@prisma/client')
const assert = require('assert')

module.exports = async () => {
  const prisma = new PrismaClient()

  const result = await prisma.user.aggregate({
    where: {
      age: {
        gt: -1,
      },
    },
    skip: 0,
    take: 10000,
    avg: {
      age: true,
    },
    count: true,
    max: {
      age: true,
    },
    min: {
      age: true,
    },
    sum: {
      age: true,
    },
  })

  assert.deepEqual(result, {
    count: 10,
    avg: { age: 80 },
    max: { age: 163 },
    min: { age: 5 },
    sum: { age: 800 },
  })

  prisma.disconnect()
}

if (require.main === module) {
  // seed()
  module.exports()
}

async function seed() {
  const prisma = new PrismaClient()
  for (let i = 0; i < 10; i++) {
    await prisma.user.create({
      data: {
        age: Math.round(Math.random() * 200),
        email: `bob+${i}@hey.com`,
        name: 'Bobby Brown',
      },
    })
  }
  prisma.disconnect()
}
