import { PrismaClient } from '@prisma/client'

// tslint:disable
const cases = {
  contructor: {
    customError: new Error('Contructor Custom Error'),
    customErrorPerModel: {
      User: new Error('Contructor Custom Error on User'),
    },
    true: true,
    false: false,
    undefined: undefined
  },
  findUnique: {
    customError: new Error('FindUnique Custom Error'),
    true: true,
    false: false,
    undefined: undefined
  }
}
// This file will not be executed, just compiled to check if the typings are valid
async function main() {
  // Contructor
  const p1 = new PrismaClient({
    rejectOnEmpty: true
  })
  const p2 = new PrismaClient({
    rejectOnEmpty: new Error('Contructor Custom Error')
  })
  const p3 = new PrismaClient({
    rejectOnEmpty: {
      User: new Error('Contructor Custom Error on User'),
      Post: true,
    },
  })

  // FindUnique
  p1.user.findUnique({
    where: { id: 'anything'},
  })
  p1.user.findUnique({
    where: { id: 'anything'},
    rejectOnEmpty: true
  })
  p1.user.findUnique({
    where: { id: 'anything'},
    rejectOnEmpty: new Error('FindUnique Custom Error')
  })
  p1.user.findUnique({
    where: { id: 'anything'},
    rejectOnEmpty: false
  })
}

main().catch((e) => {
  console.error(e)
})
