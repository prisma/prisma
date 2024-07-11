import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

/**
 * Tests for https://github.com/prisma/prisma/issues/21631, fixed in Prisma 5.12.0
 */
testMatrix.setupTestSuite(() => {
  describe("Transactions and batching (query compacting) shouldn't interfere with result sets", () => {
    async function setupData() {
      await prisma.worker.deleteMany()

      const email = 'test@prisma.io'
      const phone = '+39 123'

      await prisma.worker.create({
        data: {
          email,
          phone,
        },
      })

      return { email, phone }
    }

    test('2 independent `findUnique`s', async () => {
      const { email, phone } = await setupData()
      const notExistingPhone = `${phone}456`

      const workerFromEmail = await prisma.worker.findUnique({ where: { email } })
      const workerFromPhone = await prisma.worker.findUnique({ where: { phone: notExistingPhone } })

      expect(workerFromEmail).toMatchObject({
        email,
        phone,
      })
      expect(workerFromPhone).toEqual(null)
    })

    test('2 concurrent `findUnique`s', async () => {
      const { email, phone } = await setupData()
      const notExistingPhone = `${phone}456`

      const [workerFromEmail, workerFromPhone] = await Promise.all([
        prisma.worker.findUnique({ where: { email } }),
        prisma.worker.findUnique({ where: { phone: notExistingPhone } }),
      ])

      expect(workerFromEmail).toMatchObject({
        email,
        phone,
      })
      expect(workerFromPhone).toEqual(null)
    })

    test('2 `findUnique`s in a $transaction', async () => {
      const { email, phone } = await setupData()
      const notExistingPhone = `${phone}456`

      const [workerFromEmail, workerFromPhone] = await prisma.$transaction([
        prisma.worker.findUnique({ where: { email } }),
        prisma.worker.findUnique({ where: { phone: notExistingPhone } }),
      ])

      expect(workerFromEmail).toMatchObject({
        email,
        phone,
      })
      expect(workerFromPhone).toEqual(null)
    })
  })
})
