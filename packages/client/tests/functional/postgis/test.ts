import pg from 'pg'

import { Providers } from '../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

async function ensurePostgisTestDatabase(provider: string, databaseUrl: string): Promise<void> {
  if (provider !== Providers.POSTGRESQL) return

  const url = new URL(databaseUrl.replace(/^postgres:/, 'postgresql:'))
  const dbName = url.pathname.slice(1) || 'postgres'
  const adminUrl = new URL(databaseUrl.replace(/^postgres:/, 'postgresql:'))
  adminUrl.pathname = '/postgres'

  const client = new pg.Client({ connectionString: adminUrl.toString() })
  await client.connect()

  try {
    const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName])
    if (res.rows.length === 0) {
      await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`)
    }
  } finally {
    await client.end()
  }
}

async function ensurePostgisExtension(provider: string, databaseUrl: string): Promise<void> {
  if (provider !== Providers.POSTGRESQL) return

  const dbClient = new pg.Client({ connectionString: databaseUrl.replace(/^postgres:/, 'postgresql:') })
  await dbClient.connect()
  try {
    await dbClient.query('CREATE EXTENSION IF NOT EXISTS postgis')
  } finally {
    await dbClient.end()
  }
}

async function setupPostgisDatabase(provider: string, databaseUrl: string): Promise<void> {
  await ensurePostgisTestDatabase(provider, databaseUrl)
  await ensurePostgisExtension(provider, databaseUrl)
}

testMatrix.setupTestSuite(
  () => {
    test('basic Point geometry CRUD', async () => {
      const point: Prisma.InputGeometry = {
        type: 'Point',
        coordinates: [13.4, 52.5],
        srid: 4326,
      }

      const created = await prisma.location.create({
        data: { name: 'Berlin', position: point },
      })
      expect(created.id).toBeDefined()
      expect(created.name).toBe('Berlin')
      expect(created.position).toEqual({ type: 'Point', coordinates: [13.4, 52.5], srid: 4326 })

      const found = await prisma.location.findUnique({ where: { id: created.id } })
      expect(found?.position).toEqual({ type: 'Point', coordinates: [13.4, 52.5], srid: 4326 })

      const updated = await prisma.location.update({
        where: { id: created.id },
        data: {
          position: { type: 'Point', coordinates: [2.35, 48.85], srid: 4326 },
        },
      })
      expect(updated.position).toEqual({ type: 'Point', coordinates: [2.35, 48.85], srid: 4326 })
    })

    test('LineString geometry operations', async () => {
      const lineString: Prisma.InputGeometry = {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 1],
          [2, 0],
        ],
        srid: 4326,
      }

      const created = await prisma.route.create({
        data: { name: 'Route A', path: lineString },
      })
      expect(created.path).toEqual({
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 1],
          [2, 0],
        ],
        srid: 4326,
      })

      const found = await prisma.route.findUnique({ where: { id: created.id } })
      expect(found?.path?.type).toBe('LineString')
      expect(found?.path?.coordinates).toHaveLength(3)
    })

    test('Polygon geometry operations', async () => {
      const polygon: Prisma.InputGeometry = {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [0, 1],
            [1, 1],
            [1, 0],
            [0, 0],
          ],
        ],
        srid: 4326,
      }

      const created = await prisma.area.create({
        data: { name: 'Area A', boundary: polygon },
      })
      expect(created.boundary?.type).toBe('Polygon')
      expect(created.boundary?.coordinates).toHaveLength(1)
      expect(created.boundary?.coordinates[0]).toHaveLength(5)
    })

    test('SRID handling (4326, 3857)', async () => {
      const wgs84: Prisma.InputGeometry = {
        type: 'Point',
        coordinates: [13.4, 52.5],
        srid: 4326,
      }
      const webMercator: Prisma.InputGeometry = {
        type: 'Point',
        coordinates: [1492529.0, 6897890.0],
        srid: 3857,
      }

      const loc1 = await prisma.location.create({
        data: { name: 'WGS84', position: wgs84 },
      })
      const loc2 = await prisma.locationMercator.create({
        data: { name: 'WebMercator', position: webMercator },
      })

      expect(loc1.position?.srid).toBe(4326)
      expect(loc2.position?.srid).toBe(3857)
    })

    test('$queryRaw with PostGIS functions (ST_GeomFromText, ST_AsEWKB)', async () => {
      const result = await prisma.$queryRawUnsafe<Array<{ st_astext: string }>>(
        `SELECT ST_AsText(ST_GeomFromText('POINT(13.4 52.5)', 4326)) as st_astext`,
      )
      expect(result[0].st_astext).toBe('POINT(13.4 52.5)')
    })

    test('null geometry handling', async () => {
      const created = await prisma.location.create({
        data: { name: 'No location', position: null },
      })
      expect(created.position).toBeNull()

      const found = await prisma.location.findUnique({ where: { id: created.id } })
      expect(found?.position).toBeNull()
    })

    test('round-trip serialization', async () => {
      const point: Prisma.InputGeometry = {
        type: 'Point',
        coordinates: [-122.4194, 37.7749],
        srid: 4326,
      }

      const created = await prisma.location.create({
        data: { name: 'San Francisco', position: point },
      })
      const found = await prisma.location.findUnique({ where: { id: created.id } })
      expect(found?.position).toEqual({ type: 'Point', coordinates: [-122.4194, 37.7749], srid: 4326 })

      const foundAgain = await prisma.location.findFirst({ where: { name: 'San Francisco' } })
      expect(foundAgain?.position).toEqual({ type: 'Point', coordinates: [-122.4194, 37.7749], srid: 4326 })
    })

    test('$queryRaw returns geometry objects', async () => {
      const created = await prisma.location.create({
        data: {
          name: 'QueryRawGeometryTest',
          position: { type: 'Point', coordinates: [1, 2], srid: 4326 },
        },
      })

      const result = await prisma.$queryRaw<Array<{ position?: Prisma.Geometry }>>`
        SELECT position FROM "Location" WHERE id = ${created.id}
      `

      expect(result).toHaveLength(1)
      expect(result[0].position).toEqual({
        type: 'Point',
        coordinates: [1, 2],
        srid: 4326,
      })
    })
  },
  {
    skipProviderFlavorExpansion: true,
    optOut: {
      from: [Providers.SQLITE, Providers.MYSQL, Providers.MONGODB, Providers.COCKROACHDB, Providers.SQLSERVER],
      reason: 'PostGIS is a PostgreSQL extension',
    },
    beforeDbPushCallback: setupPostgisDatabase,
    afterForceResetCallback: ensurePostgisExtension,
  },
)
