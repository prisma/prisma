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
    beforeEach(async () => {
      await prisma.location.deleteMany({})
      await prisma.route.deleteMany({})
      await prisma.area.deleteMany({})
      await prisma.locationMercator.deleteMany({})
    })

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

    test('geometry filter: near (ST_DWithin)', async () => {
      await prisma.location.createMany({
        data: [
          { name: 'Berlin', position: { type: 'Point', coordinates: [13.4, 52.5], srid: 4326 } },
          { name: 'Paris', position: { type: 'Point', coordinates: [2.35, 48.85], srid: 4326 } },
          { name: 'London', position: { type: 'Point', coordinates: [-0.12, 51.5], srid: 4326 } },
        ],
      })

      const nearParis = await prisma.location.findMany({
        where: {
          position: {
            near: {
              point: [2.35, 48.85],
              maxDistance: 100000,
            },
          },
        },
      })

      expect(nearParis).toHaveLength(1)
      expect(nearParis[0].name).toBe('Paris')
    })

    test('geometry filter: within polygon (ST_Within)', async () => {
      await prisma.location.createMany({
        data: [
          { name: 'Center', position: { type: 'Point', coordinates: [0.5, 0.5], srid: 4326 } },
          { name: 'Outside', position: { type: 'Point', coordinates: [5, 5], srid: 4326 } },
        ],
      })

      const withinSquare = await prisma.location.findMany({
        where: {
          position: {
            within: {
              polygon: [
                [0, 0],
                [0, 1],
                [1, 1],
                [1, 0],
                [0, 0],
              ],
            },
          },
        },
      })

      expect(withinSquare).toHaveLength(1)
      expect(withinSquare[0].name).toBe('Center')
    })

    test('geometry filter: intersects with GeoJSON (ST_Intersects)', async () => {
      const polygon: Prisma.InputGeometry = {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [0, 2],
            [2, 2],
            [2, 0],
            [0, 0],
          ],
        ],
        srid: 4326,
      }

      await prisma.area.create({
        data: { name: 'TestArea', boundary: polygon },
      })

      const intersecting = await prisma.area.findMany({
        where: {
          boundary: {
            intersects: {
              geometry: {
                type: 'Polygon',
                coordinates: [
                  [
                    [1, 1],
                    [1, 3],
                    [3, 3],
                    [3, 1],
                    [1, 1],
                  ],
                ],
              },
            },
          },
        },
      })

      expect(intersecting).toHaveLength(1)
      expect(intersecting[0].name).toBe('TestArea')
    })

    test('geometry orderBy: distanceFrom (ST_Distance)', async () => {
      await prisma.location.createMany({
        data: [
          { name: 'A', position: { type: 'Point', coordinates: [0, 0], srid: 4326 } },
          { name: 'B', position: { type: 'Point', coordinates: [1, 1], srid: 4326 } },
          { name: 'C', position: { type: 'Point', coordinates: [0.1, 0.1], srid: 4326 } },
        ],
      })

      const sorted = await prisma.location.findMany({
        orderBy: {
          position: {
            distanceFrom: {
              point: [0, 0],
              direction: 'asc',
            },
          },
        },
      })

      expect(sorted).toHaveLength(3)
      expect(sorted[0].name).toBe('A')
      expect(sorted[1].name).toBe('C')
      expect(sorted[2].name).toBe('B')
    })

    test('geometry filter with custom SRID', async () => {
      await prisma.locationMercator.create({
        data: {
          name: 'Mercator Point',
          position: { type: 'Point', coordinates: [1492529.0, 6897890.0], srid: 3857 },
        },
      })

      const found = await prisma.locationMercator.findMany({
        where: {
          position: {
            near: {
              point: [1492529.0, 6897890.0],
              maxDistance: 1000,
              srid: 3857,
            },
          },
        },
      })

      expect(found).toHaveLength(1)
      expect(found[0].name).toBe('Mercator Point')
    })

    test('combined geometry filters and orderBy', async () => {
      await prisma.location.createMany({
        data: [
          { name: 'Near1', position: { type: 'Point', coordinates: [0.01, 0.01], srid: 4326 } },
          { name: 'Near2', position: { type: 'Point', coordinates: [0.02, 0.02], srid: 4326 } },
          { name: 'Far', position: { type: 'Point', coordinates: [10, 10], srid: 4326 } },
        ],
      })

      const results = await prisma.location.findMany({
        where: {
          position: {
            near: {
              point: [0, 0],
              maxDistance: 50000,
            },
          },
        },
        orderBy: {
          position: {
            distanceFrom: {
              point: [0, 0],
              direction: 'desc',
            },
          },
        },
      })

      expect(results).toHaveLength(2)
      expect(results[0].name).toBe('Near2')
      expect(results[1].name).toBe('Near1')
    })

    test('NOT filter: exclude points near location', async () => {
      await prisma.location.createMany({
        data: [
          { name: 'Close', position: { type: 'Point', coordinates: [0.01, 0.01], srid: 4326 } },
          { name: 'Far', position: { type: 'Point', coordinates: [10, 10], srid: 4326 } },
        ],
      })

      const notNear = await prisma.location.findMany({
        where: {
          NOT: {
            position: {
              near: {
                point: [0, 0],
                maxDistance: 10000,
              },
            },
          },
        },
      })

      expect(notNear).toHaveLength(1)
      expect(notNear[0].name).toBe('Far')
    })

    test('OR filter: multiple spatial conditions', async () => {
      await prisma.location.createMany({
        data: [
          { name: 'NearOrigin', position: { type: 'Point', coordinates: [0.001, 0.001], srid: 4326 } },
          { name: 'NearPole', position: { type: 'Point', coordinates: [0, 89], srid: 4326 } },
          { name: 'Middle', position: { type: 'Point', coordinates: [45, 45], srid: 4326 } },
        ],
      })

      const results = await prisma.location.findMany({
        where: {
          OR: [
            { position: { near: { point: [0, 0], maxDistance: 10000 } } },
            { position: { near: { point: [0, 90], maxDistance: 200000 } } },
          ],
        },
      })

      expect(results).toHaveLength(2)
      const names = results.map((r) => r.name).sort()
      expect(names).toEqual(['NearOrigin', 'NearPole'])
    })

    test('Polygon with hole (interior ring)', async () => {
      const polygonWithHole: Prisma.InputGeometry = {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [0, 10],
            [10, 10],
            [10, 0],
            [0, 0],
          ],
          [
            [2, 2],
            [2, 8],
            [8, 8],
            [8, 2],
            [2, 2],
          ],
        ],
        srid: 4326,
      }

      const created = await prisma.area.create({
        data: { name: 'Donut', boundary: polygonWithHole },
      })

      expect(created.boundary?.coordinates).toHaveLength(2)
      expect(created.boundary?.coordinates[1]).toHaveLength(5)
    })

    test('within filter: point in polygon with hole', async () => {
      const donut: Prisma.InputGeometry = {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [0, 10],
            [10, 10],
            [10, 0],
            [0, 0],
          ],
          [
            [3, 3],
            [3, 7],
            [7, 7],
            [7, 3],
            [3, 3],
          ],
        ],
        srid: 4326,
      }

      await prisma.area.create({ data: { name: 'Donut', boundary: donut } })

      await prisma.location.createMany({
        data: [
          { name: 'InRing', position: { type: 'Point', coordinates: [1, 1], srid: 4326 } },
          { name: 'InHole', position: { type: 'Point', coordinates: [5, 5], srid: 4326 } },
          { name: 'Outside', position: { type: 'Point', coordinates: [15, 15], srid: 4326 } },
        ],
      })

      const inDonut = await prisma.location.findMany({
        where: {
          position: {
            within: {
              polygon: [
                [0, 0],
                [0, 10],
                [10, 10],
                [10, 0],
                [0, 0],
              ],
            },
          },
        },
      })

      expect(inDonut.length).toBeGreaterThanOrEqual(1)
      expect(inDonut.some((l) => l.name === 'InRing')).toBe(true)
    })

    test('LineString with many points', async () => {
      const complexPath: Prisma.InputGeometry = {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 1],
          [2, 1],
          [3, 2],
          [4, 1],
          [5, 3],
          [6, 2],
        ],
        srid: 4326,
      }

      const route = await prisma.route.create({
        data: { name: 'ComplexRoute', path: complexPath },
      })

      expect(route.path?.coordinates).toHaveLength(7)
      expect(route.path?.coordinates[6]).toEqual([6, 2])
    })

    test('intersects: LineString crosses polygon', async () => {
      const square: Prisma.InputGeometry = {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [0, 2],
            [2, 2],
            [2, 0],
            [0, 0],
          ],
        ],
        srid: 4326,
      }

      await prisma.area.create({ data: { name: 'Square', boundary: square } })

      const crossingLine: Prisma.InputGeometry = {
        type: 'LineString',
        coordinates: [
          [-1, 1],
          [3, 1],
        ],
        srid: 4326,
      }

      await prisma.route.create({ data: { name: 'CrossingLine', path: crossingLine } })

      const intersecting = await prisma.area.findMany({
        where: {
          boundary: {
            intersects: {
              geometry: {
                type: 'LineString',
                coordinates: [
                  [-1, 1],
                  [3, 1],
                ],
              },
            },
          },
        },
      })

      expect(intersecting).toHaveLength(1)
      expect(intersecting[0].name).toBe('Square')
    })

    test('near filter: no results when too far', async () => {
      await prisma.location.create({
        data: { name: 'FarAway', position: { type: 'Point', coordinates: [100, 50], srid: 4326 } },
      })

      const results = await prisma.location.findMany({
        where: {
          position: {
            near: {
              point: [0, 0],
              maxDistance: 1000,
            },
          },
        },
      })

      expect(results).toHaveLength(0)
    })

    test('within filter: empty results when outside', async () => {
      await prisma.location.create({
        data: { name: 'Outside', position: { type: 'Point', coordinates: [10, 10], srid: 4326 } },
      })

      const results = await prisma.location.findMany({
        where: {
          position: {
            within: {
              polygon: [
                [0, 0],
                [0, 1],
                [1, 1],
                [1, 0],
                [0, 0],
              ],
            },
          },
        },
      })

      expect(results).toHaveLength(0)
    })

    test('orderBy: distance desc (farthest first)', async () => {
      await prisma.location.createMany({
        data: [
          { name: 'Close', position: { type: 'Point', coordinates: [0.1, 0.1], srid: 4326 } },
          { name: 'Medium', position: { type: 'Point', coordinates: [5, 5], srid: 4326 } },
          { name: 'Far', position: { type: 'Point', coordinates: [10, 10], srid: 4326 } },
        ],
      })

      const sorted = await prisma.location.findMany({
        orderBy: {
          position: {
            distanceFrom: {
              point: [0, 0],
              direction: 'desc',
            },
          },
        },
      })

      expect(sorted).toHaveLength(3)
      expect(sorted[0].name).toBe('Far')
      expect(sorted[1].name).toBe('Medium')
      expect(sorted[2].name).toBe('Close')
    })

    test('filter + orderBy + limit', async () => {
      await prisma.location.createMany({
        data: [
          { name: 'A', position: { type: 'Point', coordinates: [0.1, 0.1], srid: 4326 } },
          { name: 'B', position: { type: 'Point', coordinates: [0.2, 0.2], srid: 4326 } },
          { name: 'C', position: { type: 'Point', coordinates: [0.3, 0.3], srid: 4326 } },
          { name: 'Far', position: { type: 'Point', coordinates: [50, 50], srid: 4326 } },
        ],
      })

      const results = await prisma.location.findMany({
        where: {
          position: {
            near: {
              point: [0, 0],
              maxDistance: 100000,
            },
          },
        },
        orderBy: {
          position: {
            distanceFrom: {
              point: [0, 0],
              direction: 'asc',
            },
          },
        },
        take: 2,
      })

      expect(results).toHaveLength(2)
      expect(results[0].name).toBe('A')
      expect(results[1].name).toBe('B')
    })

    test('update geometry: change point location', async () => {
      const original = await prisma.location.create({
        data: {
          name: 'Moving',
          position: { type: 'Point', coordinates: [0, 0], srid: 4326 },
        },
      })

      const updated = await prisma.location.update({
        where: { id: original.id },
        data: {
          position: { type: 'Point', coordinates: [1, 1], srid: 4326 },
        },
      })

      expect(updated.position?.coordinates).toEqual([1, 1])

      const found = await prisma.location.findUnique({ where: { id: original.id } })
      expect(found?.position?.coordinates).toEqual([1, 1])
    })

    test('update geometry to null', async () => {
      const original = await prisma.location.create({
        data: {
          name: 'HasLocation',
          position: { type: 'Point', coordinates: [1, 1], srid: 4326 },
        },
      })

      const updated = await prisma.location.update({
        where: { id: original.id },
        data: { position: null },
      })

      expect(updated.position).toBeNull()
    })

    test('findFirst with geometry filter', async () => {
      await prisma.location.createMany({
        data: [
          { name: 'First', position: { type: 'Point', coordinates: [0, 0], srid: 4326 } },
          { name: 'Second', position: { type: 'Point', coordinates: [0.01, 0.01], srid: 4326 } },
        ],
      })

      const result = await prisma.location.findFirst({
        where: {
          position: {
            near: {
              point: [0, 0],
              maxDistance: 50000,
            },
          },
        },
        orderBy: { id: 'asc' },
      })

      expect(result?.name).toBe('First')
    })

    test('count with geometry filter', async () => {
      await prisma.location.createMany({
        data: [
          { name: 'P1', position: { type: 'Point', coordinates: [0, 0], srid: 4326 } },
          { name: 'P2', position: { type: 'Point', coordinates: [0.01, 0.01], srid: 4326 } },
          { name: 'P3', position: { type: 'Point', coordinates: [10, 10], srid: 4326 } },
        ],
      })

      const count = await prisma.location.count({
        where: {
          position: {
            near: {
              point: [0, 0],
              maxDistance: 10000,
            },
          },
        },
      })

      expect(count).toBe(2)
    })

    test('delete with geometry filter', async () => {
      await prisma.location.createMany({
        data: [
          { name: 'ToDelete', position: { type: 'Point', coordinates: [0, 0], srid: 4326 } },
          { name: 'ToKeep', position: { type: 'Point', coordinates: [10, 10], srid: 4326 } },
        ],
      })

      const deleted = await prisma.location.deleteMany({
        where: {
          position: {
            near: {
              point: [0, 0],
              maxDistance: 1000,
            },
          },
        },
      })

      expect(deleted.count).toBe(1)

      const remaining = await prisma.location.findMany({})
      expect(remaining).toHaveLength(1)
      expect(remaining[0].name).toBe('ToKeep')
    })

    test('Polygon boundary: exactly on edge', async () => {
      await prisma.location.createMany({
        data: [
          { name: 'OnEdge', position: { type: 'Point', coordinates: [0, 0.5], srid: 4326 } },
          { name: 'Corner', position: { type: 'Point', coordinates: [0, 0], srid: 4326 } },
          { name: 'Inside', position: { type: 'Point', coordinates: [0.5, 0.5], srid: 4326 } },
        ],
      })

      const within = await prisma.location.findMany({
        where: {
          position: {
            within: {
              polygon: [
                [0, 0],
                [0, 1],
                [1, 1],
                [1, 0],
                [0, 0],
              ],
            },
          },
        },
      })

      expect(within.length).toBeGreaterThanOrEqual(1)
      expect(within.some((l) => l.name === 'Inside')).toBe(true)
    })

    test('near filter with very small distance', async () => {
      await prisma.location.createMany({
        data: [
          { name: 'Exact', position: { type: 'Point', coordinates: [50, 50], srid: 4326 } },
          { name: 'VeryClose', position: { type: 'Point', coordinates: [50.0001, 50.0001], srid: 4326 } },
          { name: 'Close', position: { type: 'Point', coordinates: [50.001, 50.001], srid: 4326 } },
        ],
      })

      const results = await prisma.location.findMany({
        where: {
          position: {
            near: {
              point: [50, 50],
              maxDistance: 50,
            },
          },
        },
      })

      expect(results).toHaveLength(2)
      const names = results.map((r) => r.name).sort()
      expect(names).toEqual(['Exact', 'VeryClose'])
    })

    test('geometry filter combined with scalar filter', async () => {
      await prisma.location.createMany({
        data: [
          { name: 'Berlin Near', position: { type: 'Point', coordinates: [0, 0], srid: 4326 } },
          { name: 'Paris Near', position: { type: 'Point', coordinates: [0.01, 0.01], srid: 4326 } },
          { name: 'Berlin Far', position: { type: 'Point', coordinates: [10, 10], srid: 4326 } },
        ],
      })

      const results = await prisma.location.findMany({
        where: {
          AND: [
            {
              position: {
                near: {
                  point: [0, 0],
                  maxDistance: 10000,
                },
              },
            },
            { name: { startsWith: 'Berlin' } },
          ],
        },
      })

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('Berlin Near')
    })

    test('orderBy with null geometries', async () => {
      await prisma.location.createMany({
        data: [
          { name: 'NoLocation', position: null },
          { name: 'HasLocation', position: { type: 'Point', coordinates: [0, 0], srid: 4326 } },
        ],
      })

      const sorted = await prisma.location.findMany({
        orderBy: {
          position: {
            distanceFrom: {
              point: [0, 0],
              direction: 'asc',
            },
          },
        },
      })

      expect(sorted).toHaveLength(2)
      expect(sorted[0].name).toBe('HasLocation')
    })

    test('multiple geometries on same model', async () => {
      const point1: Prisma.InputGeometry = {
        type: 'Point',
        coordinates: [0, 0],
        srid: 4326,
      }
      const point2: Prisma.InputGeometry = {
        type: 'Point',
        coordinates: [1, 1],
        srid: 4326,
      }

      const _loc1 = await prisma.location.create({
        data: { name: 'Origin', position: point1 },
      })
      const _loc2 = await prisma.location.create({
        data: { name: 'Offset', position: point2 },
      })

      const near1 = await prisma.location.findMany({
        where: { position: { near: { point: [0, 0], maxDistance: 1000 } } },
      })

      const near2 = await prisma.location.findMany({
        where: { position: { near: { point: [1, 1], maxDistance: 1000 } } },
      })

      expect(near1).toHaveLength(1)
      expect(near1[0].name).toBe('Origin')
      expect(near2).toHaveLength(1)
      expect(near2[0].name).toBe('Offset')
    })

    test('projected coordinates: SRID 3857 distance calculation', async () => {
      await prisma.locationMercator.createMany({
        data: [
          { name: 'P1', position: { type: 'Point', coordinates: [1000000, 6000000], srid: 3857 } },
          { name: 'P2', position: { type: 'Point', coordinates: [1001000, 6000000], srid: 3857 } },
          { name: 'P3', position: { type: 'Point', coordinates: [1100000, 6000000], srid: 3857 } },
        ],
      })

      const near = await prisma.locationMercator.findMany({
        where: {
          position: {
            near: {
              point: [1000000, 6000000],
              maxDistance: 5000,
              srid: 3857,
            },
          },
        },
      })

      expect(near).toHaveLength(2)
      const names = near.map((p) => p.name).sort()
      expect(names).toEqual(['P1', 'P2'])
    })

    test('select specific fields with geometry filter', async () => {
      await prisma.location.createMany({
        data: [
          { name: 'Selected', position: { type: 'Point', coordinates: [0, 0], srid: 4326 } },
          { name: 'Far', position: { type: 'Point', coordinates: [50, 50], srid: 4326 } },
        ],
      })

      const results = await prisma.location.findMany({
        where: {
          position: {
            near: {
              point: [0, 0],
              maxDistance: 1000,
            },
          },
        },
        select: {
          name: true,
        },
      })

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('Selected')
      expect(results[0]).not.toHaveProperty('position')
    })

    test('Polygon intersects with another polygon', async () => {
      const polygon1: Prisma.InputGeometry = {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [0, 2],
            [2, 2],
            [2, 0],
            [0, 0],
          ],
        ],
        srid: 4326,
      }

      const polygon2: Prisma.InputGeometry = {
        type: 'Polygon',
        coordinates: [
          [
            [1, 1],
            [1, 3],
            [3, 3],
            [3, 1],
            [1, 1],
          ],
        ],
        srid: 4326,
      }

      await prisma.area.create({ data: { name: 'Area1', boundary: polygon1 } })
      await prisma.area.create({ data: { name: 'Area2', boundary: polygon2 } })

      const overlapping = await prisma.area.findMany({
        where: {
          boundary: {
            intersects: {
              geometry: {
                type: 'Polygon',
                coordinates: [
                  [
                    [1, 1],
                    [1, 3],
                    [3, 3],
                    [3, 1],
                    [1, 1],
                  ],
                ],
              },
            },
          },
        },
      })

      expect(overlapping.length).toBeGreaterThanOrEqual(1)
    })

    test('extremely close points: sub-meter precision', async () => {
      await prisma.location.createMany({
        data: [
          { name: 'P1', position: { type: 'Point', coordinates: [0, 0], srid: 4326 } },
          { name: 'P2', position: { type: 'Point', coordinates: [0.000001, 0.000001], srid: 4326 } },
          { name: 'P3', position: { type: 'Point', coordinates: [0.00001, 0.00001], srid: 4326 } },
        ],
      })

      const veryClose = await prisma.location.findMany({
        where: {
          position: {
            near: {
              point: [0, 0],
              maxDistance: 1,
            },
          },
        },
      })

      expect(veryClose.length).toBeGreaterThanOrEqual(1)
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
