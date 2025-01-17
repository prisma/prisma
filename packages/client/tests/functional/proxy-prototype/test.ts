import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    // context: we test that PrismaClient can work with cloudflare RPCs
    // so that it can be "passed" accross boundaries between workers
    test('prototype of proxies is object prototype', () => {
      expect(Object.getPrototypeOf(prisma)).toBe(Object.prototype)
      expect(Object.getPrototypeOf(prisma.user)).toBe(Object.prototype)
      expect(Object.getPrototypeOf(prisma.user.findFirst)).toBe(Function.prototype)
    })
  },
  {
    optOut: {
      from: ['postgresql', 'mysql', 'mongodb', 'cockroachdb', 'sqlserver'],
      reason: 'This is a client-only test',
    },
  },
)
