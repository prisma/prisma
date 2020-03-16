import { PrismaClient, Post, User, version } from '@prisma/client'

// tslint:disable

// This file will not be executed, just compiled to check if the typings are valid
async function main() {
  const prisma = new PrismaClient()

  version.client

  const result1 = await prisma.User.findMany({
    where: {
      posts: {
        some: {
          author: {
            AND: {
              id: '5',
              posts: {
                some: {
                  author: {
                    posts: {
                      some: {
                        title: '5',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  result1[0]!.email
  result1[0]!.id
  result1[0]!.name

  const result2: {
    id: string
    createdAt: Date
    updatedAt: Date
    published: boolean
    title: string
    content: string | null
    author: User | null
  } | null = await prisma.Post.findOne({
    where: {
      id: '',
    },
    include: {
      author: true,
    },
  })

  const result3: 'Please either choose `select` or `include`' = await prisma.Post.findMany(
    {
      select: {},
      include: {},
    },
  )

  const result4: Array<{
    id: string
    author: {
      name: string | null
    } | null
  }> = await prisma.Post.findMany({
    select: {
      id: true,
      author: {
        select: {
          name: true,
        },
      },
    },
  })

  const result5: Post = await prisma.Post.create({
    data: {
      published: false,
      title: 'Title',
    },
  })

  await prisma.Post.delete({
    where: {
      id: '',
    },
  })

  await prisma.Post.upsert({
    create: {
      published: false,
      title: 'Title',
    },
    update: {
      published: true,
    },
    where: {
      id: '6',
    },
  })

  await prisma.Post.updateMany({
    data: {
      published: false,
    },
  })

  const disconnect: Promise<void> = prisma.disconnect()
}

main().catch(e => {
  console.error(e)
})
