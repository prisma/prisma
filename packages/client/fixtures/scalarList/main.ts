import { PrismaClient } from './@prisma/client'

async function main() {
  const prisma = new PrismaClient()

  await prisma.user.create({
    data: {
      hobbies: {
        set: [
          'sample 1 string',
          '7fb1aef9-5250-4cf6-92c7-b01f53862822',
          'sample 3 string',
          '575e0b28-81fa-43e0-8f05-708a98d55c14',
          'sample 5 string',
        ],
      },
      name: 'name',
    },
  })
  prisma.disconnect()
}

main().catch(console.error)
