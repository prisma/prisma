import { Providers } from '../_utils/providers'
import { checkIfEmpty } from '../_utils/relationMode/checkIfEmpty'
import { ConditionalError } from '../_utils/relationMode/conditionalError'
import testMatrix from './_matrix'

/* eslint-disable @typescript-eslint/no-unused-vars, jest/no-identical-title */

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)
const testIf = (condition: boolean) => (condition ? test : test.skip)

// 1:1 relation
async function createXItems({ count }) {
  const prismaPromises: any = []

  for (let i = 0; i < count; i++) {
    // We want to start at 1
    const id = (i + 1).toString()
    const prismaPromise = prisma.main.create({
      data: {
        id,
        bob: {
          create: { id },
        },
        alice: {
          create: { id },
        },
      },
      include: {
        bob: true,
        alice: true,
      },
    })
    prismaPromises.push(prismaPromise)
  }

  return await prisma.$transaction(prismaPromises)
}

testMatrix.setupTestSuite(
  (suiteConfig, suiteMeta) => {
    const conditionalError = ConditionalError.new()
      .with('provider', suiteConfig.provider)
      .with('providerFlavor', suiteConfig.providerFlavor)
      // @ts-ignore
      .with('relationMode', suiteConfig.relationMode || 'foreignKeys')

    const onUpdate = suiteConfig.onUpdate
    const onDelete = suiteConfig.onDelete

    describe('issue-17255', () => {
      beforeEach(async () => {
        // The order is important here
        const queries = [prisma.bob.deleteMany(), prisma.main.deleteMany(), prisma.alice.deleteMany()]
        await prisma.$transaction(queries)
        await checkIfEmpty('alice', 'bob', 'main')
        await createXItems({
          count: 2,
        })
      })

      describeIf(['Restrict', 'NoAction', 'SetNull'].includes(onUpdate))(
        'onUpdate: Restrict, NoAction, SetNull',
        () => {
          test('relationMode=foreignKeys [update] main with nested delete alice should fail', async () => {
            const errors = {
              DEFAULT:
                "The change you are trying to make would violate the required relation 'BobToMain' between the `Bob` and `Main` models.",
              // It's inverted for Restrict only?
              Restrict:
                "The change you are trying to make would violate the required relation 'AliceToMain' between the `Alice` and `Main` models.",
              NoAction:
                "The change you are trying to make would violate the required relation 'AliceToMain' between the `Alice` and `Main` models.",
            }

            const bobCountBefore = await prisma.bob.count()

            // now, update the main instance and delete alice
            await expect(
              prisma.main.update({
                where: { id: '1' },
                data: { alice: { delete: true } },
              }),
            ).rejects.toThrow(
              conditionalError.snapshot({
                foreignKeys: {
                  [Providers.POSTGRESQL]: 'Foreign key constraint failed on the field: `Main_aliceId_fkey (index)`',
                  [Providers.COCKROACHDB]: 'Foreign key constraint failed on the field: `(not available)`',
                  [Providers.MYSQL]: 'Foreign key constraint failed on the field: `aliceId`',
                  [Providers.SQLSERVER]: 'Foreign key constraint failed on the field: `Main_aliceId_fkey (index)`',
                  [Providers.SQLITE]: 'Foreign key constraint failed on the field: `foreign key`',
                },
                prisma: errors[onDelete],
              }),
            )

            const bobCountAfter = await prisma.bob.count()
            // No deletion should happen
            expect(bobCountAfter).toEqual(bobCountBefore)

            expect(
              await prisma.main.findMany({
                orderBy: { id: 'asc' },
              }),
            ).toEqual([
              {
                id: '1',
                // We expect the that aliceId stays the same
                aliceId: '1',
              },
              { id: '2', aliceId: '2' },
            ])
            expect(
              await prisma.bob.findMany({
                orderBy: { id: 'asc' },
              }),
            ).toEqual([
              {
                id: '1',
                mainId: '1',
              },
              { id: '2', mainId: '2' },
            ])
            expect(
              await prisma.alice.findMany({
                orderBy: { id: 'asc' },
              }),
            ).toEqual([
              {
                id: '1',
              },
              { id: '2' },
            ])
          })
        },
      )

      describeIf(['DEFAULT'].includes(onDelete))('onDelete: DEFAULT', () => {
        test('[update] main with nested delete alice should succeed', async () => {
          const bobCountBefore = await prisma.bob.count()

          // now, update the main instance and delete alice
          await prisma.main.update({
            where: { id: '1' },
            data: { alice: { delete: true } },
          })

          const bobCountAfter = await prisma.bob.count()
          // No deletion should happen
          expect(bobCountAfter).toEqual(bobCountBefore)

          expect(
            await prisma.main.findMany({
              orderBy: { id: 'asc' },
            }),
          ).toEqual([
            {
              id: '1',
              // We expect that aliceId turns null
              aliceId: null,
            },
            { id: '2', aliceId: '2' },
          ])
          expect(
            await prisma.bob.findMany({
              orderBy: { id: 'asc' },
            }),
          ).toEqual([
            {
              id: '1',
              mainId: '1',
            },
            { id: '2', mainId: '2' },
          ])
          expect(
            await prisma.alice.findMany({
              orderBy: { id: 'asc' },
            }),
          ).toEqual([
            // We expect the deletion of "1" to happen
            { id: '2' },
          ])
        })
      })

      describeIf(['Cascade'].includes(onDelete))('onDelete: Cascade', () => {
        test('[update] main with nested delete alice should succeed', async () => {
          const bobCountBefore = await prisma.bob.count()

          // now, update the main instance and delete alice
          await prisma.main.update({
            where: { id: '1' },
            data: { alice: { delete: true } },
          })

          const bobCountAfter = await prisma.bob.count()
          // Deletion should happen
          expect(bobCountAfter).toEqual(bobCountBefore - 1)

          expect(
            await prisma.main.findMany({
              orderBy: { id: 'asc' },
            }),
          ).toEqual([
            // We expect the deletion of "1" to happen
            { id: '2', aliceId: '2' },
          ])
          expect(
            await prisma.bob.findMany({
              orderBy: { id: 'asc' },
            }),
          ).toEqual([
            // We expect the deletion of "1" to happen
            { id: '2', mainId: '2' },
          ])
          expect(
            await prisma.alice.findMany({
              orderBy: { id: 'asc' },
            }),
          ).toEqual([
            // We expect the deletion of "1" to happen
            { id: '2' },
          ])
        })

        test('[update] main with nested disconnect alice should succeed', async () => {
          const bobCountBefore = await prisma.bob.count()

          // now, update the main instance and delete alice
          await prisma.main.update({
            where: { id: '1' },
            data: { alice: { disconnect: true } },
          })

          const bobCountAfter = await prisma.bob.count()

          // No deletion should happen
          expect(bobCountAfter).toEqual(bobCountBefore)

          expect(
            await prisma.main.findMany({
              orderBy: { id: 'asc' },
            }),
          ).toEqual([
            {
              id: '1',
              // We expect the disconnect to happen
              aliceId: null,
            },
            { id: '2', aliceId: '2' },
          ])
          expect(
            await prisma.bob.findMany({
              orderBy: { id: 'asc' },
            }),
          ).toEqual([
            {
              id: '1',
              mainId: '1',
            },
            { id: '2', mainId: '2' },
          ])
          expect(
            await prisma.alice.findMany({
              orderBy: { id: 'asc' },
            }),
          ).toEqual([
            {
              id: '1',
            },
            { id: '2' },
          ])
        })
      })
    })
  },
  // Use `optOut` to opt out from testing the default selected providers
  // otherwise the suite will require all providers to be specified.
  {
    optOut: {
      from: ['sqlite', 'mongodb', 'cockroachdb', 'sqlserver', 'mysql', 'postgresql'],
      reason: 'Only testing xyz provider(s) so opting out of xxx',
    },
  },
)
