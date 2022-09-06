import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient
declare let Prisma: typeof PrismaNamespace

testMatrix.setupTestSuite(
  (_suiteConfig, _suiteMeta, clientMeta) => {
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

      // TODO: Edge: skipped because of the error snapshot
      testIf(clientMeta.runtime !== 'edge')('DbNull', async () => {
        await expect(
          prisma.requiredJsonField.create({
            data: {
              // @ts-expect-error
              json: Prisma.DbNull,
            },
          }),
        ).rejects.toMatchPrismaErrorInlineSnapshot(`

                    Invalid \`prisma.requiredJsonField.create()\` invocation in
                    /client/tests/functional/json-null-types/tests.ts:0:0

                      XX 
                      XX test('DbNull', async () => {
                      XX   await expect(
                    → XX     prisma.requiredJsonField.create({
                               data: {
                                 json: Prisma.DbNull
                                       ~~~~~~~~~~~~~
                               }
                             })

                    Argument json: Provided value Prisma.DbNull of type DbNull on prisma.createOneRequiredJsonField is not a JsonNullValueInput.
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

      // TODO: Edge: skipped because of the error snapshot
      testIf(clientMeta.runtime !== 'edge')('custom instances are not allowed', async () => {
        await expect(
          prisma.requiredJsonField.create({
            data: {
              // @ts-expect-error
              json: new Prisma.NullTypes.JsonNull(),
            },
          }),
        ).rejects.toMatchPrismaErrorInlineSnapshot(`

          Invalid \`prisma.requiredJsonField.create()\` invocation in
          /client/tests/functional/json-null-types/tests.ts:0:0

            XX 
            XX test('custom instances are not allowed', async () => {
            XX   await expect(
          → XX     prisma.requiredJsonField.create({
                     data: {
                       json: new Prisma.NullTypes.JsonNull()
                             ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                     }
                   })

          Argument json: Provided value new Prisma.NullTypes.JsonNull() of type JsonNull on prisma.createOneRequiredJsonField is not a JsonNullValueInput.
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
