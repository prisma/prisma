import { expectTypeOf } from 'expect-type'
import testMatrix from './_matrix'
// @ts-ignore
import type { Form, FormResponse, PrismaClient, User } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite((_suiteConfig, _suiteMeta, _clientMeta, cliMeta) => {
  describe('whereUnique with compound unique constraints', () => {
    let user1: User
    let user2: User
    let form1: Form
    let form2: Form
    let formResponse1: FormResponse
    let formResponse2: FormResponse

    beforeEach(async () => {
      // Clean up
      await prisma.formResponse.deleteMany()
      await prisma.form.deleteMany()
      await prisma.user.deleteMany()

      // Create test data
      user1 = await prisma.user.create({
        data: {
          email: 'user1@example.com',
        },
      })

      user2 = await prisma.user.create({
        data: {
          email: 'user2@example.com',
        },
      })

      form1 = await prisma.form.create({
        data: {
          title: 'Form 1',
        },
      })

      form2 = await prisma.form.create({
        data: {
          title: 'Form 2',
        },
      })

      formResponse1 = await prisma.formResponse.create({
        data: {
          creatorId: user1.id,
          formId: form1.id,
        },
      })

      formResponse2 = await prisma.formResponse.create({
        data: {
          creatorId: user1.id,
          formId: form2.id,
        },
      })
    })

    test('whereUnique returns single result instead of array in select', async () => {
      const result = await prisma.form.findMany({
        select: {
          id: true,
          title: true,
          responses: {
            whereUnique: {
              creatorId: user1.id,
            },
            select: {
              id: true,
              creatorId: true,
            },
          },
        },
      })

      expect(result).toHaveLength(2)

      // Find form1 result
      const form1Result = result.find((f) => f.id === form1.id)
      expect(form1Result).toBeDefined()
      expect(form1Result?.responses).not.toBeNull()
      expect(form1Result?.responses).not.toBeUndefined()

      // responses should NOT be an array when whereUnique is used
      expect(Array.isArray(form1Result?.responses)).toBe(false)

      // It should be a single object or null
      if (form1Result?.responses) {
        expect(form1Result.responses).toHaveProperty('id')
        expect(form1Result.responses).toHaveProperty('creatorId')
        expect(form1Result.responses.id).toBe(formResponse1.id)
        expect(form1Result.responses.creatorId).toBe(user1.id)
      }

      // Find form2 result
      const form2Result = result.find((f) => f.id === form2.id)
      expect(form2Result).toBeDefined()
      expect(form2Result?.responses).not.toBeNull()
      if (form2Result?.responses) {
        expect(form2Result.responses.id).toBe(formResponse2.id)
      }
    })

    test('whereUnique returns null when no match found', async () => {
      const result = await prisma.form.findMany({
        select: {
          id: true,
          responses: {
            whereUnique: {
              creatorId: user2.id, // user2 has no responses
            },
            select: {
              id: true,
            },
          },
        },
      })

      expect(result).toHaveLength(2)

      // Both forms should have null responses for user2
      for (const form of result) {
        expect(form.responses).toBeNull()
      }
    })

    test('whereUnique works with include', async () => {
      const result = await prisma.form.findMany({
        include: {
          responses: {
            whereUnique: {
              creatorId: user1.id,
            },
          },
        },
      })

      expect(result).toHaveLength(2)

      const form1Result = result.find((f) => f.id === form1.id)
      expect(form1Result).toBeDefined()

      // responses should NOT be an array
      expect(Array.isArray(form1Result?.responses)).toBe(false)

      if (form1Result?.responses) {
        expect(form1Result.responses.id).toBe(formResponse1.id)
        expect(form1Result.responses.creatorId).toBe(user1.id)
        expect(form1Result.responses.formId).toBe(form1.id)
      }
    })

    test('whereUnique type is nullable, not array', async () => {
      const result = await prisma.form.findMany({
        select: {
          responses: {
            whereUnique: {
              creatorId: user1.id,
            },
            select: {
              id: true,
            },
          },
        },
      })

      // Type check - responses should be FormResponse | null, not FormResponse[]
      expectTypeOf(result[0].responses).not.toEqualTypeOf<FormResponse[]>()
      expectTypeOf(result[0].responses).toEqualTypeOf<{ id: string } | null>()
    })

    test('cannot use both where and whereUnique', async () => {
      await expect(
        prisma.form.findMany({
          select: {
            responses: {
              // @ts-expect-error - should not allow both
              where: { creatorId: user1.id },
              whereUnique: { creatorId: user1.id },
            },
          },
        }),
      ).rejects.toMatchPrismaErrorInlineSnapshot(`
        "
        Invalid \`prisma.form.findMany()\` invocation in
        /client/tests/functional/issues/28376-where-unique-relation/tests.ts:0:0

          XX   test('cannot use both where and whereUnique', async () => {
        → XX     await expect(
                   prisma.form.findMany({
                     select: {
                       responses: {
                         where: { creatorId: user1.id },
                         whereUnique: { creatorId: user1.id },
                       },
                     },
                   }),
                 ).rejects.toMatchPrismaErrorInlineSnapshot(

        Cannot use both \`where\` and \`whereUnique\` on the same relation."
      `)
    })

    test('whereUnique works with nested select', async () => {
      const result = await prisma.form.findMany({
        select: {
          id: true,
          title: true,
          responses: {
            whereUnique: {
              creatorId: user1.id,
            },
            select: {
              id: true,
              creator: {
                select: {
                  email: true,
                },
              },
            },
          },
        },
      })

      expect(result).toHaveLength(2)

      const form1Result = result.find((f) => f.id === form1.id)
      if (form1Result?.responses) {
        expect(form1Result.responses.creator).toBeDefined()
        expect(form1Result.responses.creator?.email).toBe('user1@example.com')
      }
    })

    test('whereUnique returns null for form with no matching response', async () => {
      const newForm = await prisma.form.create({
        data: {
          title: 'Form 3',
        },
      })

      const result = await prisma.form.findUnique({
        where: { id: newForm.id },
        select: {
          id: true,
          responses: {
            whereUnique: {
              creatorId: user1.id,
            },
            select: {
              id: true,
            },
          },
        },
      })

      expect(result).toBeDefined()
      expect(result?.responses).toBeNull()
    })
  })
})

