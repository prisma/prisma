import { expectError } from 'tsd'
import { PrismaClient, User } from '.'

const prisma = new PrismaClient()
;(async () => {
  expectError(
    await prisma.user.findFirst().posts({
      extraField: {},
    }),
  )

  // Can't use select and include at the same time
  expectError(async () => {
    let author: User = await prisma.post.findFirst().author({
      select: {
        name: true,
      },
      include: {
        posts: true,
      },
    })
  })
})()
