const {
  PrismaClient,
} = require('@prisma/client')
const assert = require('assert')

module.exports = async () => {
  const prisma = new PrismaClient()

  await prisma.profile.deleteMany()
  await prisma.user.deleteMany()
  await prisma.post.deleteMany()

  const someDate = new Date("2020-01-01T00:00:00.348Z")

  await prisma.user.create({
    data: {
      email: `a@hey.com`,
      name: `Bob`,
      wakesUpAt: someDate,
      lastLoginAt: someDate,
      posts: {
        create: new Array(5).fill(undefined).map((_, i) => ({
          published: true,
          title: 'mytitle',
          content: 'somecontent',
          optionnal: 'optionnal',
          lastReviewedAt: someDate,
          lastPublishedAt: someDate
        })),
      },
      profile: {
        create: {
          bio: 'something',
          notrequired: 'hello',
          goesToBedAt: someDate,
          goesToOfficeAt: someDate
        },
      },
    },
  })

  const user = await prisma.user.findOne({
    where: {
      email: `a@hey.com`, 
    }
  })

  const updateNullResult = await prisma.user.update({
    where: {
      id: user.id,
    },
    select: {
      id: true,
      email: true,
      name: true,
      wakesUpAt: true,
      lastLoginAt: true,
      profile: true,
      posts: true
    },
    data: {
      name: null,
      wakesUpAt: null,
      lastLoginAt: {
        set: null
      },
      profile: {
        update: {
          notrequired: null,
          bio: {
            set: null,
          },
          goesToBedAt: null,
          goesToOfficeAt: {
            set: null
          }
        }
      },
      posts: {
        updateMany: {
          data: {
            content: null,
            optionnal: {
              set: null,
            },
            lastReviewedAt: null,
            lastPublishedAt: {
              set: null
            }
          },
          where: {},
        },
      },
    }
  })

  assert.strictEqual(updateNullResult.name, null)
  assert.strictEqual(updateNullResult.wakesUpAt, null)
  assert.strictEqual(updateNullResult.lastLoginAt, null)
  assert.strictEqual(updateNullResult.profile.bio, null)
  assert.strictEqual(updateNullResult.profile.notrequired, null)
  assert.strictEqual(updateNullResult.profile.goesToBedAt, null)
  assert.strictEqual(updateNullResult.profile.goesToOfficeAt, null)
  assert.strictEqual(updateNullResult.posts.length, 5)
  assert.strictEqual(updateNullResult.posts[0].content, null)
  assert.strictEqual(updateNullResult.posts[0].optionnal, null)
  assert.strictEqual(updateNullResult.posts[0].lastReviewedAt, null)
  assert.strictEqual(updateNullResult.posts[0].lastPublishedAt, null)

  await prisma.profile.deleteMany()
  await prisma.user.deleteMany()
  await prisma.post.deleteMany()
  
  prisma.$disconnect()
}

if (require.main === module) {
  module.exports()
}
