import { AdapterProviders, Providers } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  (suiteConfig) => {
    describe('unique constraint violation', () => {
      const user1_cuid = 'tz4a98xxat96iws9zmbrgj3a'
      const user2_cuid = 'tz4a98xxat96iws9zmbrgj3b'

      // Create a user with the same email as the test email
      // This is to ensure that the test email is already in the database
      beforeAll(async () => {
        await prisma.user.create({
          data: {
            id: user1_cuid,
            email: suiteConfig.testEmail,
          },
        })
      })

      describe('modelName is returned on error.meta', () => {
        it('should return modelName on error.meta when performing prisma.model.create', async () => {
          const createDuplicateUserWithEmail = async () => {
            await prisma.user.create({
              data: {
                email: suiteConfig.testEmail,
              },
            })
          }

          try {
            await createDuplicateUserWithEmail()
            // If the above function doesn't throw an error, fail the test
            expect(true).toBe(false)
          } catch (e) {
            expect(e.name).toBeDefined()
            expect(e.code).toBeDefined()
            expect(e.meta).toBeDefined()
            expect(e.meta.modelName).toBeDefined()
            expect(e.name).toBe('PrismaClientKnownRequestError')
            expect(e.code).toBe('P2002')
            expect(e.meta.modelName).toBe('User')
          }
        })

        it('should return modelName on error.meta when performing prisma$transaction with the client', async () => {
          const createDuplicateUserWithEmail = async () => {
            await prisma.$transaction([
              prisma.user.create({
                data: {
                  email: suiteConfig.testEmail,
                },
              }),
              prisma.user.create({
                data: {
                  email: suiteConfig.testEmail,
                },
              }),
            ])
          }

          try {
            await createDuplicateUserWithEmail()
            // If the above function doesn't throw an error, fail the test
            expect(true).toBe(false)
          } catch (e) {
            expect(e.name).toBeDefined()
            expect(e.code).toBeDefined()
            expect(e.meta).toBeDefined()
            expect(e.meta.modelName).toBeDefined()
            expect(e.name).toBe('PrismaClientKnownRequestError')
            expect(e.code).toBe('P2002')
            expect(e.meta.modelName).toBe('User')
          }
        })
      })

      describe('modelName is not returned on error.meta', () => {
        it('should not return modelName when performing queryRaw', async () => {
          const createTwoUserWithSameEmail = async () => {
            if (suiteConfig.provider === Providers.MYSQL) {
              await prisma.$queryRaw`INSERT INTO \`User\` (\`id\`, \`email\`) VALUES (${user2_cuid}, ${suiteConfig.testEmail});`
            } else {
              await prisma.$queryRaw`INSERT INTO "User" (id, email) VALUES (${user2_cuid}, ${suiteConfig.testEmail});`
            }
          }

          try {
            await createTwoUserWithSameEmail()
            // If the above function doesn't throw an error, fail the test
            expect(true).toBe(false)
          } catch (e) {
            expect(e.name).toBeDefined()
            expect(e.code).toBeDefined()
            expect(e.meta).toBeDefined()
            expect(e.name).toBe('PrismaClientKnownRequestError')
            expect(e.code).toBe('P2010')
            expect(Object.keys(e.meta).includes('modelName')).toBe(false)
          }
        })

        it('should not return modelName when performing executeRaw', async () => {
          const createTwoUserWithSameEmail = async () => {
            if (suiteConfig.provider === Providers.MYSQL) {
              await prisma.$executeRaw`INSERT INTO \`User\` (\`id\`, \`email\`) VALUES (${user2_cuid}, ${suiteConfig.testEmail});`
            } else {
              await prisma.$executeRaw`INSERT INTO "User" (id, email) VALUES (${user2_cuid}, ${suiteConfig.testEmail});`
            }
          }

          try {
            await createTwoUserWithSameEmail()
            // If the above function doesn't throw an error, fail the test
            expect(true).toBe(false)
          } catch (e) {
            expect(e.name).toBeDefined()
            expect(e.code).toBeDefined()
            expect(e.meta).toBeDefined()
            expect(e.name).toBe('PrismaClientKnownRequestError')
            expect(e.code).toBe('P2010')
            expect(Object.keys(e.meta).includes('modelName')).toBe(false)
          }
        })

        it('should not return modelName when performing transactions with raw queries', async () => {
          const createTwoUserWithSameEmail = async () => {
            if (suiteConfig.provider === Providers.MYSQL) {
              await prisma.$transaction([
                prisma.$executeRaw`INSERT INTO \`User\` (\`id\`, \`email\`) VALUES (${user2_cuid}, ${suiteConfig.testEmail});`,
                prisma.$executeRaw`INSERT INTO \`User\` (\`id\`, \`email\`) VALUES (${user2_cuid}, ${suiteConfig.testEmail});`,
              ])
            } else {
              await prisma.$transaction([
                prisma.$executeRaw`INSERT INTO "User" (id, email) VALUES (${user2_cuid}, ${suiteConfig.testEmail});`,
                prisma.$executeRaw`INSERT INTO "User" (id, email) VALUES (${user2_cuid}, ${suiteConfig.testEmail});`,
              ])
            }
          }

          try {
            await createTwoUserWithSameEmail()
            // If the above function doesn't throw an error, fail the test
            expect(true).toBe(false)
          } catch (e) {
            expect(e.name).toBeDefined()
            expect(e.code).toBeDefined()
            expect(e.meta).toBeDefined()
            expect(e.name).toBe('PrismaClientKnownRequestError')
            expect(e.code).toBe('P2010')
            expect(Object.keys(e.meta).includes('modelName')).toBe(false)
          }
        })
      })
    })
  },
  {
    optOut: {
      from: [Providers.MONGODB],
      reason: "MongoDB doesn't support raw queries",
    },
    skipDriverAdapter: {
      from: [AdapterProviders.JS_LIBSQL],
      reason: 'js_libsql: SIGABRT due to panic in libsql (not yet implemented: array)', // TODO: ORM-867
    },
  },
)
