import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
  testIf(process.env.TEST_DATA_PROXY !== undefined)('check versions on `_engine`', async () => {
    expect((prisma as any)._engine.remoteClientVersion).toBe(undefined)
    expect((prisma as any)._engine.clientVersion).toBe('0.0.0')
    expect((prisma as any)._engine.engineHash).toBe('0000000000000000000000000000000000000000')
    expect((prisma as any)._engine.version()).toBe('0000000000000000000000000000000000000000')

    await prisma.$connect()

    expect((prisma as any)._engine.remoteClientVersion).toBe('0.0.0')
    expect((prisma as any)._engine.clientVersion).toBe('0.0.0')
    expect((prisma as any)._engine.engineHash).toBe('0000000000000000000000000000000000000000')
    expect((prisma as any)._engine.version()).toBe('0000000000000000000000000000000000000000')
  })
})
