import * as path from 'path'

import { getTestSuiteSchema } from '../_utils/getTestSuiteInfo'
import testMatrix from './_matrix'

// @ts-ignore
declare let prisma: import('@prisma/client').PrismaClient

function createXYData() {
  const xyContents = [] as { content: string }[]
  for (let i = 0; i < 1000; i++) {
    xyContents.push({ content: 'a' })
  }

  return xyContents
}

testMatrix.setupTestSuite((suiteConfig, suiteMeta) => {
  beforeAll(async () => {
    await prisma.user.create({
      data: {
        posts: {
          createMany: {
            data: createXYData(),
          },
        },
      },
    })
  })

  test('update concurrent', async () => {
    const promises = [] as Promise<any>[]

    for (let i = 0; i < 100; i++) {
      promises.push(
        prisma.post.updateMany({
          where: {
            content: 'y',
          },
          data: {
            content: 'x',
          },
        }),
      )
      promises.push(
        prisma.post.updateMany({
          where: {
            content: 'a',
          },
          data: {
            content: 'y',
          },
        }),
      )
    }

    await Promise.all(promises)

    const posts = await prisma.post.findMany({})

    const firstContent = posts[0].content

    console.log(posts.reduce((acc, post) => [...acc, post.content], [] as string[]))
    posts.forEach((post) => {
      if (post.content !== firstContent) {
        console.log(firstContent, post.content)
      }
    })

    // console.log(posts)
  })
})
