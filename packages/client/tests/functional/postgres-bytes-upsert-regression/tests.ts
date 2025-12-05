import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
  test('regression test - PostgreSQL Bytes upsert should work correctly', async () => {
    // Test String ID upserts work (control test)
    const stringId = 'hello world!'
    const upsertStringRow = () =>
      prisma.testStringId.upsert({
        create: {
          id: stringId,
          value: 'hello world!',
        },
        where: {
          id: stringId,
        },
        update: {},
      })

    await upsertStringRow()
    await upsertStringRow() // Should not throw

    // Test Bytes ID upserts work (the actual regression test)
    const byteId = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    const upsertByteRow = () =>
      prisma.testByteId.upsert({
        create: {
          id: byteId,
          value: 'hello world!',
        },
        where: {
          id: byteId,
        },
        update: {},
      })

    await upsertByteRow()
    // This second call was failing in v7 with "No record was found for an upsert"
    await upsertByteRow() // Should not throw
    
    // Verify the record exists and has correct data
    const result = await prisma.testByteId.findUnique({
      where: { id: byteId }
    })
    expect(result).toBeTruthy()
    expect(result?.value).toBe('hello world!')
  })
})