const { PrismaClient } = require('@prisma/client')
const assert = require('assert')

module.exports = async () => {
  const prisma = new PrismaClient()

  const set = await prisma.user.update({
    where: {
      email: 'b@b.de',
    },
    data: {
      countInt: 1,
      countFloat: 0.0,
    },
  })

  assert.deepStrictEqual(set, {
    id: '576eddf9-1111-421f-9a86-58bede16fd11',
    email: 'b@b.de',
    name: 'Alex',
    countInt: 1,
    countFloat: 0.0,
  })

  const increment = await prisma.user.update({
    where: {
      email: 'b@b.de',
    },
    data: {
      countInt: {
        increment: 1,
      },
      countFloat: {
        increment: 1.54321,
      },
    },
  })

  assert.deepStrictEqual(increment, {
    id: '576eddf9-1111-421f-9a86-58bede16fd11',
    email: 'b@b.de',
    name: 'Alex',
    countInt: 2,
    countFloat: 1.54321,
  })

  const decrement = await prisma.user.update({
    where: {
      email: 'b@b.de',
    },
    data: {
      countInt: {
        decrement: 1,
      },
      countFloat: {
        decrement: 1.54321,
      },
    },
  })

  assert.deepStrictEqual(decrement, {
    id: '576eddf9-1111-421f-9a86-58bede16fd11',
    email: 'b@b.de',
    name: 'Alex',
    countInt: 1,
    countFloat: 0.0,
  })

  prisma.$disconnect()
}

if (require.main === module) {
  module.exports()
}
