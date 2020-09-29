import fs from 'fs'
import path from 'path'
import { getPlatform } from '@prisma/get-platform'
import { generateTestClient } from '../../../../utils/getTestClient'

test('corruption', async () => {
  await generateTestClient()
  const { PrismaClient } = require('./node_modules/@prisma/client')
  const platform = await getPlatform()
  const binaryPath = path.join(
    __dirname,
    'node_modules/.prisma/client',
    `query-engine-${platform}`,
  )
  fs.writeFileSync(binaryPath, 'hello world')

  const prisma = new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
    ],
    errorFormat: 'minimal',
  })

  try {
    await prisma.user.findMany()
  } catch (e) {
    expect(e.clientVersion).toMatchInlineSnapshot(`local`)
    expect(e).toMatchInlineSnapshot(`
      Query engine exited with code 127

      /client/src/__tests__/integration/errors/corruption/node_modules/.prisma/client/query-engine-TEST_PLATFORM: line 1: hello: command not found
    `)

    prisma.$disconnect()
  }
})
