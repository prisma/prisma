import { generateTestClient } from '../../../../utils/getTestClient'
import fs from 'fs'
import path from 'path'
import { getPlatform } from '@prisma/get-platform'

test('missing-binary-native', async () => {
  await generateTestClient()

  const { PrismaClient } = require('./node_modules/@prisma/client')

  const platform = await getPlatform()
  const binaryPath = path.join(
    __dirname,
    'node_modules/.prisma/client',
    `query-engine-${platform}`,
  )
  fs.unlinkSync(binaryPath)
  const prisma = new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
    ],
  })

  try {
    await prisma.user.findMany()
  } catch (e) {
    expect(e.clientVersion).toMatchInlineSnapshot(`local`)
    expect(e).toMatchInlineSnapshot(`

      Invalid \`prisma.user.findMany()\` invocation in
      /client/src/__tests__/integration/errors/missing-binary-native/test.ts:28:23


        Query engine binary for current platform "TEST_PLATFORM" could not be found.
      This probably happens, because you built Prisma Client on a different platform.
      (Prisma Client looked in "/client/src/__tests__/integration/errors/missing-binary-native/node_modules/@prisma/client/runtime/query-engine-TEST_PLATFORM")

      Files in /client/src/__tests__/integration/errors/missing-binary-native/node_modules/@prisma/client/runtime:

        Dataloader.d.ts
        browser-chalk.d.ts
        browser-terminal-link.d.ts
        browser.d.ts
        dmmf-types.d.ts
        dmmf.d.ts
        error-types.d.ts
        externalToInternalDmmf.d.ts
        getLogLevel.d.ts
        getPrismaClient.d.ts
        highlight
        index.d.ts
        index.js
        index.js.map
        mergeBy.d.ts
        query.d.ts
        transformDmmf.d.ts
        utils
        visit.d.ts

      You already added the platform "native" to the "generator" block
      in the "schema.prisma" file as described in https://pris.ly/d/client-generator,
      but something went wrong. That's suboptimal.

      Please create an issue at TEST_GITHUB_LINK
    `)

    prisma.$disconnect()
  }
})
