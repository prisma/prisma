import { generateTestClient } from '../../../../utils/getTestClient'
import fs from 'fs'
import path from 'path'
import { getPlatform } from '@prisma/get-platform'

test('missing-binary', async () => {
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
      /client/src/__tests__/integration/errors/missing-binary/test.ts:28:23


        Query engine binary for current platform "TEST_PLATFORM" could not be found.
      This probably happens, because you built Prisma Client on a different platform.
      (Prisma Client looked in "/client/src/__tests__/integration/errors/missing-binary/node_modules/@prisma/client/runtime/query-engine-TEST_PLATFORM")

      Files in /client/src/__tests__/integration/errors/missing-binary/node_modules/@prisma/client/runtime:

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


      To solve this problem, add the platform "TEST_PLATFORM" to the "generator" block in the "schema.prisma" file:
      generator client {
        provider      = "prisma-client-js"
        binaryTargets = ["native"]
      }

      Then run "prisma generate" for your changes to take effect.
      Read more about deploying Prisma Client: https://pris.ly/d/client-generator
    `)

    prisma.$disconnect()
  }
})
