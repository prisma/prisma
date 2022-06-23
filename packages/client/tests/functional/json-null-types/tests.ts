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
                /client/tests/functional/json-null-types/tests.ts:42:36

                  39 
                  40 test('DbNull', async () => {
                  41   await expect(
                → 42     prisma.requiredJsonField.create({
                           data: {
                             json: Prisma.DbNull
                                   ~~~~~~~~~~~~~
                           }
                         })

                Argument json: Provided value Prisma.DbNull of type DbNull on prisma.createOneRequiredJsonField is not a enumTypes.
                → Possible values: JsonNullValueInput.JsonNull


              `)
      })
    })

    describe('properties of DbNull/JsonNull/AnyNull', () => {
      test('instanceof checks pass', () => {
        expect(Prisma.DbNull).toBeInstanceOf(Prisma.NullTypes.DbNull)
        expect(Prisma.JsonNull).toBeInstanceOf(Prisma.NullTypes.JsonNull)
        expect(Prisma.AnyNull).toBeInstanceOf(Prisma.NullTypes.AnyNull)
      })

      test('custom instances are not allowed', async () => {
        await expect(
          prisma.requiredJsonField.create({
            data: {
              // @ts-expect-error
              json: new Prisma.NullTypes.JsonNull(),
            },
          }),
        ).rejects.toThrowErrorMatchingInlineSnapshot(`

                Invalid \`prisma.requiredJsonField.create()\` invocation in
                /client/tests/functional/json-null-types/tests.ts:80:36

                   77 
                   78 test('custom instances are not allowed', async () => {
                   79   await expect(
                →  80     prisma.requiredJsonField.create({
                            data: {
                              json: new Prisma.NullTypes.JsonNull()
                                    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                            }
                          })

                Argument json: Provided value new Prisma.NullTypes.JsonNull() of type JsonNull on prisma.createOneRequiredJsonField is not a enumTypes.
                → Possible values: JsonNullValueInput.JsonNull


              `)
      })
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
