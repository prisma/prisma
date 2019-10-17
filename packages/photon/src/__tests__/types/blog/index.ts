import { Photon, Post, User } from './@generated/photon'

// tslint:disable

// This file will not be executed, just compiled to check if the typings are valid
async function main() {
  const photon = new Photon()

  const result1 = await photon.users.findMany({
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
  } = await photon.posts.findOne({
    where: {
      id: '',
    },
    include: {
      author: true,
    },
  })

  const result3: 'Please either choose `select` or `include`' = await photon.posts.findMany({
    select: {},
    include: {},
  })

  const result4: Array<{
    id: string
    author: {
      name: string | null
    } | null
  }> = await photon.posts.findMany({
    select: {
      id: true,
      author: {
        select: {
          name: true,
        },
      },
    },
  })

  const result5: Post = await photon.posts.create({
    data: {
      published: false,
      title: 'Title',
    },
  })

  await photon.posts.delete({
    where: {
      id: '',
    },
  })

  await photon.posts.upsert({
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

  await photon.posts.updateMany({
    data: {
      published: false,
    },
  })

  const disconnect: Promise<void> = photon.disconnect()
}

main().catch(e => {
  console.error(e)
})
