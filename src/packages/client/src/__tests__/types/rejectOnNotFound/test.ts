import { PrismaClient } from '@prisma/client'

// tslint:disable

// This file will not be executed, just compiled to check if the typings are valid
async function main() {
  // Contructor
  const p1 = new PrismaClient({
    rejectOnNotFound: true,
  })

  const p21 = new PrismaClient({
    rejectOnNotFound: () => new Error('Error'),
  })
  const p3 = new PrismaClient({
    rejectOnNotFound: {
      findUnique: () => new Error('Error'),
      findFirst: true,
    },
  })
  const p4 = new PrismaClient({
    rejectOnNotFound: {
      findUnique: {
        User: true,
        MachineData: () => new Error('Error'),
        Post: () => new Error('Error'),
      },
      findFirst: false,
    },
  })
  // FindUnique
  p1.user.findUnique({
    where: { id: 'anything' },
  })
  p1.user.findUnique({
    where: { id: 'anything' },
    rejectOnNotFound: true,
  })
  p1.user.findUnique({
    where: { id: 'anything' },
    rejectOnNotFound: () => new Error('FindUnique Custom Error'),
  })
  p1.user.findUnique({
    where: { id: 'anything' },
    rejectOnNotFound: () => new Error('FindUnique Custom Error'),
  })
  p1.user.findUnique({
    where: { id: 'anything' },
    rejectOnNotFound: false,
  })

  // FindFirst
  p1.user.findFirst({
    where: { id: 'anything' },
  })
  p1.user.findFirst({
    where: { id: 'anything' },
    rejectOnNotFound: true,
  })
  p1.user.findFirst({
    where: { id: 'anything' },
    rejectOnNotFound: () => new Error('FindUnique Custom Error'),
  })
  p1.user.findFirst({
    where: { id: 'anything' },
    rejectOnNotFound: () => new Error('FindUnique Custom Error'),
  })
  p1.user.findFirst({
    where: { id: 'anything' },
    rejectOnNotFound: false,
  })
}

main().catch((e) => {
  console.error(e)
})
