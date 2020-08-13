const { PrismaClient } = require('@prisma/client')
const assert = require('assert')

module.exports = async () => {
  const prisma = new PrismaClient()

  const a = []
  a.push(await prisma.user.findOne({
    where: {
      email: 'a@a.de'
    }
  })
    .property())

  a.push(await prisma.user.findOne({
    where: {
      email: 'a@a.de'
    }
  })
    .property()
    .house())

  a.push(await prisma.user.findOne({
    where: {
      email: 'a@a.de'
    }
  })
    .property()
    .house()
    .like())

  a.push(await prisma.user.findOne({
    where: {
      email: 'a@a.de'
    }
  })
    .property()
    .house()
    .like()
    .post())

  a.push(await prisma.user.findOne({
    where: {
      email: 'a@a.de'
    }
  })
    .property()
    .house()
    .like()
    .post()
    .author())

  a.push(await prisma.user.findOne({
    where: {
      email: 'a@a.de'
    }
  })
    .property()
    .house()
    .like()
    .post()
    .author()
    .property())

  prisma.$disconnect()
  return a
}

if (require.main === module) {
  module.exports()
}
