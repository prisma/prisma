import type { MachineData, Post, User } from '@prisma/client'
import { PrismaClient } from '@prisma/client'

// This file will not be executed, just compiled to check if the typings are valid
async function main() {
  const p1 = new PrismaClient({
    rejectOnNotFound: true,
  })
  const r1p1: User = await p1.user.findFirst()
  const r2p1: User = await p1.user.findFirst({
    rejectOnNotFound: true,
  })
  const r3p1: User | null = await p1.user.findFirst({
    rejectOnNotFound: false,
  })
  const r4p1: User = await p1.user.findFirst({
    rejectOnNotFound: () => new Error('Error'),
  })
  const r5p1: User = await p1.user.findUnique({
    where: { id: '' },
    rejectOnNotFound: () => new Error('Error'),
  })

  const p2 = new PrismaClient({
    rejectOnNotFound: {
      findFirst: true,
      findUnique: true,
    },
  })
  const r1p2: User = await p2.user.findFirst()
  const r2p2: Post = await p2.post.findFirst()

  const r3p2: Post = await p2.post.findUnique({ where: { id: '' } })
  const r4p2: User = await p2.user.findUnique({ where: { id: '' } })

  const r5p2: Post | null = await p2.post.findUnique({
    where: { id: '' },
    rejectOnNotFound: false,
  })
  const r6p2: User | null = await p2.user.findUnique({
    where: { id: '' },
    rejectOnNotFound: false,
  })

  const p3 = new PrismaClient({
    rejectOnNotFound: {
      findFirst: {
        User: true,
        Post: () => new Error(),
      },
      findUnique: {
        User: true,
        Post: false,
      },
    },
  })
  const r1p3: User = await p3.user.findFirst()
  const r2p3: Post | null = await p3.post.findUnique({ where: { id: '' } })

  const p4 = new PrismaClient({
    rejectOnNotFound: {
      findUnique: () => new Error('Error'),
      findFirst: true,
    },
  })
  const r1p4: User = await p4.user.findUnique({ where: { id: '' } })
  const r2p4: User = await p4.user.findFirst({
    rejectOnNotFound: true,
  })
  const p5 = new PrismaClient({
    rejectOnNotFound: {
      findUnique: {
        User: false,
        MachineData: () => new Error('Error'),
        Post: false,
      },
      findFirst: false,
    },
  })
  // FindUnique
  const r1p5: User | null = await p5.user.findUnique({
    where: { id: 'anything' },
  })
  const r2p5: MachineData = await p5.machineData.findUnique({
    where: { id: 'anything' },
    rejectOnNotFound: true,
  })
  const r3p5: Post = await p5.post.findUnique({
    where: { id: 'anything' },
    rejectOnNotFound: () => new Error('FindUnique Custom Error'),
  })
  const r4p5: User = await p5.user.findUnique({
    where: { id: 'anything' },
    rejectOnNotFound: () => new Error('FindUnique Custom Error'),
  })
  const r5p5: User | null = await p5.user.findUnique({
    where: { id: 'anything' },
    rejectOnNotFound: false,
  })

  // FindFirst
  const r6p5: User | null = await p5.user.findFirst({
    where: { id: 'anything' },
  })
  const r7p5: User = await p5.user.findFirst({
    where: { id: 'anything' },
    rejectOnNotFound: true,
  })
  const r8p5: User = await p5.user.findFirst({
    where: { id: 'anything' },
    rejectOnNotFound: () => new Error('FindUnique Custom Error'),
  })
  const r9p5: User | null = await p5.user.findFirst({
    where: { id: 'anything' },
    rejectOnNotFound: false,
  })
}

main().catch((e) => {
  console.error(e)
})
