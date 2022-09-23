import { Prisma, PrismaClient, User, Post } from '@prisma/client'

async function main() {
  const prisma = new PrismaClient()

  const where: Prisma.UserWhereInput = {
    id: 'foo',
  }

  // @ts-expect-error where should be readonly
  where.OR = []

  // @ts-expect-error arrays should also be readonly
  where.OR.push({
    profile: {
      name: 'bar',
    },
  })

  const user: User | null = await prisma.user.findFirst({ where })

  // query result is not readonly
  if (user) user.createdAt = new Date()

  const where2: Prisma.PostWhereInput = {
    user: where,
  }

  const posts: Post[] = await prisma.post.findMany({ where: where2 })
}

main()
