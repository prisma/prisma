import testMatrix from './_matrix'
import { setup } from './_setup'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

// arbitrarily chose delete operation to test errors for invalid inputs
testMatrix.setupTestSuite(() => {
  test('where and no keys provided', async () => {
    const result = prisma.user.delete({
      // @ts-expect-error
      where: {},
    })

    await expect(result).rejects.toMatchPrismaErrorInlineSnapshot(`

      Invalid \`prisma.user.delete()\` invocation in
      /client/tests/functional/extended-where/errors.ts:0:0

         XX // arbitrarily chose delete operation to test errors for invalid inputs
         XX testMatrix.setupTestSuite(() => {
        XX   test('where and no keys provided', async () => {
      → XX     const result = prisma.user.delete({
                 where: {
               ?   id?: String,
               ?   referralId?: String,
               ?   AND?: UserWhereInput | UserWhereInput[],
               ?   OR?: UserWhereInput,
               ?   NOT?: UserWhereInput | UserWhereInput[],
               ?   posts?: PostListRelationFilter,
               ?   profile?: ProfileRelationFilter | ProfileWhereInput | null
                 }
               })

      Argument where of type UserWhereUniqueInput needs at least one argument and at least one argument for id, or referralId.  Available args are listed in green.

      Note: Lines with ? are optional.

    `)
  })

  test('where and missing unique keys', async () => {
    const result = prisma.user.delete({
      // @ts-expect-error
      where: {
        profile: {},
      },
    })

    await expect(result).rejects.toMatchPrismaErrorInlineSnapshot(`

      Invalid \`prisma.user.delete()\` invocation in
      /client/tests/functional/extended-where/errors.ts:0:0

        XX })
        XX 
        XX test('where and missing unique keys', async () => {
      → XX   const result = prisma.user.delete({
               where: {
                 profile: {}
               }
             })

      Argument where of type UserWhereUniqueInput needs at least one argument and at least one argument for id, or referralId.  Available args are listed in green.


    `)
  })
})
