import { getNapiName, getPlatform } from '@prisma/get-platform'
import fs from 'fs'
import path from 'path'
import { generateTestClient } from '../../../../utils/getTestClient'

test('missing-binary', async () => {
  if (process.env.PRISMA_FORCE_NAPI === 'true') {
    return
  }
  expect.assertions(1)
  await generateTestClient()

  const { PrismaClient } = require('./node_modules/@prisma/client')

  const platform = await getPlatform()
  const binaryPath = process.env.PRISMA_FORCE_NAPI
    ? path.join(
        __dirname,
        'node_modules/.prisma/client',
        getNapiName(platform, 'fs'),
      )
    : path.join(
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
  if (process.env.PRISMA_FORCE_NAPI) {
    await expect(async () => {
      await prisma.user.findMany()
    }).rejects.toThrowErrorMatchingInlineSnapshot(`

                                    Invalid \`prisma.user.findMany()\` invocation:


                                      Query engine library for current platform "TEST_PLATFORM" could not be found.
                                    You incorrectly pinned it to TEST_PLATFORM

                                    This probably happens, because you built Prisma Client on a different platform.
                                    (Prisma Client looked in "/client/src/__tests__/integration/errors/missing-binary/node_modules/@prisma/client/runtime/libquery_engine_napi-TEST_PLATFORM.so.node")

                                    Searched Locations:

                                      /client/src/__tests__/integration/errors/missing-binary/node_modules/.prisma/client
                                      /client/src/__tests__/integration/errors/missing-binary/node_modules/@prisma/client/runtime
                                      /client/src/__tests__/integration/errors/missing-binary/node_modules/@prisma/client
                                      /client/src/__tests__/integration/errors/missing-binary/node_modules/.prisma/client
                                      /client/src/__tests__/integration/errors/missing-binary
                                      /client/src/__tests__/integration/errors/missing-binary/node_modules/.prisma/client


                                    To solve this problem, add the platform "TEST_PLATFORM" to the "binaryTargets" attribute in the "generator" block in the "schema.prisma" file:
                                    generator client {
                                      provider      = "prisma-client-js"
                                      binaryTargets = ["native"]
                                    }

                                    Then run "prisma generate" for your changes to take effect.
                                    Read more about deploying Prisma Client: https://pris.ly/d/client-generator
                              `)
  } else {
    await expect(async () => {
      await prisma.user.findMany()
    }).rejects.toThrowErrorMatchingInlineSnapshot(`

            Invalid \`prisma.user.findMany()\` invocation:


              Query engine binary for current platform "TEST_PLATFORM" could not be found.
            This probably happens, because you built Prisma Client on a different platform.
            (Prisma Client looked in "/client/src/__tests__/integration/errors/missing-binary/node_modules/@prisma/client/runtime/query-engine-TEST_PLATFORM")

            Searched Locations:

              /client/src/__tests__/integration/errors/missing-binary/node_modules/.prisma/client
              /client/src/__tests__/integration/errors/missing-binary/node_modules/@prisma/client/runtime
              /client/src/__tests__/integration/errors/missing-binary/node_modules/@prisma/client
              /client/src/__tests__/integration/errors/missing-binary/node_modules/.prisma/client
              /client/src/__tests__/integration/errors/missing-binary
              /tmp/prisma-engines
              /client/src/__tests__/integration/errors/missing-binary/node_modules/.prisma/client


            To solve this problem, add the platform "TEST_PLATFORM" to the "binaryTargets" attribute in the "generator" block in the "schema.prisma" file:
            generator client {
              provider      = "prisma-client-js"
              binaryTargets = ["native"]
            }

            Then run "prisma generate" for your changes to take effect.
            Read more about deploying Prisma Client: https://pris.ly/d/client-generator
          `)
  }
})
