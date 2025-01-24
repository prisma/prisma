import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

test('should not create a Foo record because the database trigger always throws an exception', async () => {
  await expect(
    prisma.$transaction(async (transactionClient: PrismaClient) => {
      await transactionClient.foo.create({})
    }),
  ).rejects.toThrow('Query Error: ERROR: Foo cannot be created!')
})
