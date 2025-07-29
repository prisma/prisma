import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

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

    test('all properties are enumerable', () => {
      const keys = Object.keys(prisma)
      expect(keys).toInclude('user')
      expect(keys).toInclude('$transaction')
    })

    test('original constructor can be retrieved for @prisma/extension-read-replicas', () => {
      const Constructor = Object.getPrototypeOf(Reflect.get(prisma, '_originalClient')).constructor
      const prisma2 = new Constructor()
      void prisma2.$disconnect()
      expect(prisma2.user).toBeDefined()

      prisma.$extends((client) => {
        const Constructor = Object.getPrototypeOf(Reflect.get(prisma, '_originalClient')).constructor
        const prisma2 = new Constructor()
        void prisma2.$disconnect()
        expect(prisma2.user).toBeDefined()

        return client.$extends({})
      })
    })
  },
  {
    optOut: {
      from: ['postgresql', 'mysql', 'mongodb', 'cockroachdb', 'sqlserver'],
      reason: 'This is a client-only test',
    },
    skipEngine: {
      from: ['client'],
      reason: 'constructor is missing driver adapter params',
    },
    skipDriverAdapter: {
      from: ['js_d1', 'js_libsql', 'js_neon', 'js_pg', 'js_planetscale', 'vitess_8', 'js_better_sqlite3'],
      reason: 'constructor is missing driver adapter params',
    },
  },
)
