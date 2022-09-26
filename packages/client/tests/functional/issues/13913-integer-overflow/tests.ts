import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
  test('int overflow', async () => {
    const promise = prisma.resource.create({
      data: {
        number: 2265000000,
      },
    })

    await expect(promise).rejects.toMatchObject({
      message: expect.stringContaining('Failed to validate the query'),
      code: 'P2009',
    })

    // TODO: stack trace is not able to locate this error via dataproxy
    if (!process.env.DATA_PROXY) {
      await expect(promise).rejects.toMatchPrismaErrorInlineSnapshot(`

      Invalid \`prisma.resource.create()\` invocation in
      /client/tests/functional/issues/13913-integer-overflow/tests.ts:0:0

        XX 
        XX testMatrix.setupTestSuite(() => {
        XX   test('int overflow', async () => {
      → XX     const promise = prisma.resource.create(
      Failed to validate the query: \`Unable to match input value to any allowed input type for the field. Parse errors: [Query parsing/validation error at \`Mutation.createOneResource.data.ResourceCreateInput.number\`: Unable to fit integer value '2265000000' into a 32-bit signed integer for field 'number'., Query parsing/validation error at \`Mutation.createOneResource.data.ResourceUncheckedCreateInput.number\`: Unable to fit integer value '2265000000' into a 32-bit signed integer for field 'number'.]\` at \`Mutation.createOneResource.data\`
    `)
    }
  })
})
