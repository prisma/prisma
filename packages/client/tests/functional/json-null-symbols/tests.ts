import testMatrix from './_matrix'

// @ts-ignore
declare let prisma: import('@prisma/client').PrismaClient
// @ts-ignore
declare let Prisma: typeof import('@prisma/client').Prisma

testMatrix.setupTestSuite(
  () => {
    describe('nullableJsonField', () => {
      test('JsonNull', async () => {
        const data = await prisma.nullableJsonField.create({
          data: {
            json: Prisma.JsonNull,
          },
        })
        expect(data.json).toBe(null)
      })

      test('DbNull', async () => {
        const data = await prisma.nullableJsonField.create({
          data: {
            json: Prisma.DbNull,
          },
        })
        expect(data.json).toBe(null)
      })
    })

    describe('requiredJsonField', () => {
      test('JsonNull', async () => {
        const data = await prisma.requiredJsonField.create({
          data: {
            json: Prisma.JsonNull,
          },
        })
        expect(data.json).toBe(null)
      })
    })

    test('DbNull', async () => {
      await expect(
        prisma.requiredJsonField.create({
          data: {
            // @ts-expect-error
            json: Prisma.DbNull,
          },
        }),
      ).rejects.toThrowErrorMatchingInlineSnapshot(`

              Invalid \`prisma.requiredJsonField.create()\` invocation in
              /client/tests/functional/json-null-symbols/tests.ts:43:34

                40 
                41 test('DbNull', async () => {
                42   await expect(
              → 43     prisma.requiredJsonField.create({
                         data: {
                           json: Prisma.DbNull
                           ~~~~~~~~~~~~~~~
                         }
                       })

              Argument json: Provided value Prisma.DbNull of type DbNull on prisma.createOneRequiredJsonField is not a enumTypes.
              → Possible values: JsonNullValueInput.JsonNull


            `)
    })
  },
  {
    optOut: {
      from: ['sqlite', 'sqlserver', 'mongodb'],
      reason: `
        sqlite - connector does not support Json type
        sqlserver - connector does not support Json type
        mongodb - doesn't use DbNull/JsonNull
      `,
    },
  },
)
