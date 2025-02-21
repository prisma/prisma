import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
  test('throws on undefined argument', async () => {
    const result = prisma.user.findMany({ where: undefined })
    await expect(result).rejects.toMatchPrismaErrorInlineSnapshot(`
      "
      Invalid \`prisma.user.findMany()\` invocation in
      /client/tests/functional/strictUndefinedChecks/test.ts:0:0

        XX 
        XX testMatrix.setupTestSuite(() => {
        XX   test('throws on undefined argument', async () => {
      → XX     const result = prisma.user.findMany({
                where: undefined
                       ~~~~~~~~~
              })

      Invalid value for argument \`undefined\`: explicitly \`undefined\` values are not allowed."
    `)
  })

  test('throws on undefined input field', async () => {
    const result = prisma.user.findMany({ where: { email: undefined } })
    await expect(result).rejects.toMatchPrismaErrorInlineSnapshot(`
      "
      Invalid \`prisma.user.findMany()\` invocation in
      /client/tests/functional/strictUndefinedChecks/test.ts:0:0

        XX })
        XX 
        XX test('throws on undefined input field', async () => {
      → XX   const result = prisma.user.findMany({
               where: {
                 email: undefined
                        ~~~~~~~~~
               }
             })

      Invalid value for argument \`where\`: explicitly \`undefined\` values are not allowed."
    `)
  })

  test('throws on undefined select field', async () => {
    const result = prisma.user.findFirst({ select: { id: true, posts: undefined } })
    await expect(result).rejects.toMatchPrismaErrorInlineSnapshot(`
      "
      Invalid \`prisma.user.findFirst()\` invocation in
      /client/tests/functional/strictUndefinedChecks/test.ts:0:0

        XX })
        XX 
        XX test('throws on undefined select field', async () => {
      → XX   const result = prisma.user.findFirst({
               select: {
                 id: true,
                 posts: undefined
                        ~~~~~~~~~
               }
             })

      Invalid value for selection field \`posts\`: explicitly \`undefined\` values are not allowed"
    `)
  })

  test('throws on undefined include field', async () => {
    const result = prisma.user.findFirst({ include: { posts: undefined } })
    await expect(result).rejects.toMatchPrismaErrorInlineSnapshot(`
      "
      Invalid \`prisma.user.findFirst()\` invocation in
      /client/tests/functional/strictUndefinedChecks/test.ts:0:0

        XX })
        XX 
        XX test('throws on undefined include field', async () => {
      → XX   const result = prisma.user.findFirst({
               include: {
                 posts: undefined
                        ~~~~~~~~~
               }
             })

      Invalid value for selection field \`posts\`: explicitly \`undefined\` values are not allowed"
    `)
  })

  test('throws on undefined omit field', async () => {
    const result = prisma.user.findFirst({ omit: { id: undefined } })
    await expect(result).rejects.toMatchPrismaErrorInlineSnapshot(`
      "
      Invalid \`prisma.user.findFirst()\` invocation in
      /client/tests/functional/strictUndefinedChecks/test.ts:0:0

        XX })
        XX 
        XX test('throws on undefined omit field', async () => {
      → XX   const result = prisma.user.findFirst({
               omit: {
                 id: undefined
                     ~~~~~~~~~
               }
             })

      Invalid value for selection field \`id\`: explicitly \`undefined\` values are not allowed"
    `)
  })

  test('throws on nested include', async () => {
    const result = prisma.user.findFirst({ include: { posts: { include: { author: undefined } } } })
    await expect(result).rejects.toMatchPrismaErrorInlineSnapshot(`
      "
      Invalid \`prisma.user.findFirst()\` invocation in
      /client/tests/functional/strictUndefinedChecks/test.ts:0:0

        XX })
        XX 
        XX test('throws on nested include', async () => {
      → XX   const result = prisma.user.findFirst({
                include: {
                  posts: {
                    include: {
                      author: undefined
                              ~~~~~~~~~
                    }
                  }
                }
              })

      Invalid value for selection field \`author\`: explicitly \`undefined\` values are not allowed"
    `)
  })

  test('throws on nested select', async () => {
    const result = prisma.user.findFirst({ select: { posts: { select: { author: undefined } } } })
    await expect(result).rejects.toMatchPrismaErrorInlineSnapshot(`
      "
      Invalid \`prisma.user.findFirst()\` invocation in
      /client/tests/functional/strictUndefinedChecks/test.ts:0:0

        XX })
        XX 
        XX test('throws on nested select', async () => {
      → XX   const result = prisma.user.findFirst({
                select: {
                  posts: {
                    select: {
                      author: undefined
                              ~~~~~~~~~
                    }
                  }
                }
              })

      Invalid value for selection field \`author\`: explicitly \`undefined\` values are not allowed"
    `)
  })

  test('throws on nested omit', async () => {
    const result = prisma.user.findFirst({ select: { posts: { omit: { id: undefined } } } })
    await expect(result).rejects.toMatchPrismaErrorInlineSnapshot(`
      "
      Invalid \`prisma.user.findFirst()\` invocation in
      /client/tests/functional/strictUndefinedChecks/test.ts:0:0

        XX })
        XX 
        XX test('throws on nested omit', async () => {
      → XX   const result = prisma.user.findFirst({
                select: {
                  posts: {
                    omit: {
                      id: undefined
                          ~~~~~~~~~
                    }
                  }
                }
              })

      Invalid value for selection field \`id\`: explicitly \`undefined\` values are not allowed"
    `)
  })
})
