import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
  test('correctly deserializes Date objects in JSON fields', async () => {
    const user = await prisma.user.create({
      data: {
        properties: {
          dateField: new Date(),
        },
      },
    })

    expect(user).toMatchObject({
      properties: {
        dateField: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      },
    })
  })

  test('correctly deserializes Date objects in JSON fields with $type', async () => {
    const user = await prisma.user.create({
      data: {
        properties: {
          $type: 'Json',
          dateField: new Date(),
        },
      },
    })

    expect(user).toMatchObject({
      properties: {
        $type: 'Json',
        dateField: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      },
    })
  })
})
