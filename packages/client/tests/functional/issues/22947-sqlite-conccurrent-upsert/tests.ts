import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

/**
 * Tests for:
 * - https://github.com/prisma/prisma/issues/22947
 */
testMatrix.setupTestSuite(
  () => {
    test('concurrent upserts should succeed', async () => {
      const user = await prisma.user.create({
        data: {
          name: 'Jeffrey Danley',
          email: 'jeff@mail.com',
          username: 'Fireship',
          avatar: 'https://yt3.googleusercontent.com/...',
          password: 'password123',
          bio: 'High-intensity ...',
        },
      })

      const videos = [
        {
          name: 'browser past',
          url: '/static/videos/browser-paste.mp4',
          tags: ['Programming', 'Web Development', 'JavaScript'],
        },
        {
          name: 'file types',
          url: '/static/videos/file-types.mp4',
          tags: ['Programming', 'Operating Systems'],
        },
        {
          name: 'pages in 4d',
          url: '/static/videos/pages-in-3d.mp4',
          tags: ['Programming', 'Web Development', 'CSS'],
        },
        {
          name: 'story of web',
          url: '/static/videos/story-of-web.mp4',
          tags: ['Programming', 'Web Development'],
        },
      ]

      for (const video of videos) {
        const tags = await Promise.all(
          video.tags.map((name) =>
            prisma.tag.upsert({
              where: { name },
              update: {},
              create: { name },
            }),
          ),
        )

        const created = await prisma.video.create({
          data: {
            title: video.name,
            description: video.name,
            url: video.url,
            userId: user.id,
          },
        })

        await Promise.all(tags.map((tag) => prisma.videoTag.create({ data: { videoId: created.id, tagId: tag.id } })))
      }
    })
  },
  {
    optOut: {
      from: ['sqlserver', 'mongodb', 'postgresql', 'cockroachdb', 'mysql'],
      reason: 'Test is made for SQLite only',
    },
  },
)
