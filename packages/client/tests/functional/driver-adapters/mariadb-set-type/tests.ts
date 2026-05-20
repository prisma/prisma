import { defaultTestSuiteOptions } from '../_utils/test-suite-options'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    beforeAll(async () => {
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS VehicleSet (
          id   INT          AUTO_INCREMENT PRIMARY KEY,
          type SET('car','truck','van') DEFAULT NULL
        )
      `
    })

    afterAll(async () => {
      await prisma.$executeRaw`DROP TABLE IF EXISTS VehicleSet`
    })

    test('SET column with a single active value returns a plain string', async () => {
      await prisma.$executeRaw`INSERT INTO VehicleSet (type) VALUES ('car')`
      const rows = await prisma.$queryRaw<{ id: number; type: string }[]>`
        SELECT id, type FROM VehicleSet ORDER BY id DESC LIMIT 1
      `
      expect(rows[0].type).toBe('car')
    })

    test('SET column with multiple active values returns a comma-joined string', async () => {
      await prisma.$executeRaw`INSERT INTO VehicleSet (type) VALUES ('car,truck')`
      const rows = await prisma.$queryRaw<{ id: number; type: string }[]>`
        SELECT id, type FROM VehicleSet ORDER BY id DESC LIMIT 1
      `
      expect(rows[0].type).toBe('car,truck')
    })

    test('SET column with NULL returns null', async () => {
      await prisma.$executeRaw`INSERT INTO VehicleSet (type) VALUES (NULL)`
      const rows = await prisma.$queryRaw<{ id: number; type: string | null }[]>`
        SELECT id, type FROM VehicleSet ORDER BY id DESC LIMIT 1
      `
      expect(rows[0].type).toBeNull()
    })
  },
  {
    ...defaultTestSuiteOptions,
    skipDriverAdapter: {
      from: ['js_planetscale'],
      reason: 'SET column type is a MariaDB/MySQL feature not supported by PlanetScale',
    },
  },
)
