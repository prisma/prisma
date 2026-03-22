import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    // ============================================================
    // ALL SCALAR TYPES
    // ============================================================

    test('create and read all scalar types', async () => {
      const record = await prisma.typeTest.create({
        data: {
          boolVal: true,
          intVal: 42,
          bigIntVal: BigInt('9007199254740993'),
          floatVal: 3.14159,
          strVal: 'hello surrealdb',
          dateVal: new Date('2024-06-15T12:00:00.000Z'),
          jsonVal: { nested: { key: 'value' }, array: [1, 2, 3] },
        },
      })

      expect(record.boolVal).toBe(true)
      expect(record.intVal).toBe(42)
      expect(record.bigIntVal).toBe(BigInt('9007199254740993'))
      expect(record.floatVal).toBeCloseTo(3.14159, 4)
      expect(record.strVal).toBe('hello surrealdb')
      expect(record.dateVal).toEqual(new Date('2024-06-15T12:00:00.000Z'))
      expect(record.jsonVal).toEqual({ nested: { key: 'value' }, array: [1, 2, 3] })
    })

    test('read back all types via findUnique', async () => {
      const created = await prisma.typeTest.create({
        data: {
          boolVal: false,
          intVal: -100,
          bigIntVal: BigInt(0),
          floatVal: 0.0,
          strVal: '',
          dateVal: new Date('2000-01-01T00:00:00.000Z'),
          jsonVal: null,
        },
      })

      const fetched = await prisma.typeTest.findUnique({
        where: { id: created.id },
      })

      expect(fetched).not.toBeNull()
      expect(fetched!.boolVal).toBe(false)
      expect(fetched!.intVal).toBe(-100)
      expect(fetched!.floatVal).toBe(0.0)
      expect(fetched!.strVal).toBe('')
    })

    // ============================================================
    // SPECIAL STRING VALUES (injection prevention)
    // ============================================================

    test('handles special characters in strings', async () => {
      const record = await prisma.typeTest.create({
        data: {
          boolVal: true,
          intVal: 1,
          bigIntVal: BigInt(1),
          floatVal: 1.0,
          strVal: "O'Reilly's \"book\" with \\backslash and 日本語",
          dateVal: new Date(),
          jsonVal: { key: "value with 'quotes'" },
        },
      })

      const fetched = await prisma.typeTest.findUnique({
        where: { id: record.id },
      })

      expect(fetched!.strVal).toBe("O'Reilly's \"book\" with \\backslash and 日本語")
    })

    // ============================================================
    // UNIQUE CONSTRAINTS
    // ============================================================

    test('unique constraint enforced', async () => {
      await prisma.uniqueTest.create({
        data: { code: 'ALPHA', value: 1 },
      })

      await expect(
        prisma.uniqueTest.create({
          data: { code: 'ALPHA', value: 2 },
        }),
      ).rejects.toThrow()
    })

    test('unique field findUnique', async () => {
      const record = await prisma.uniqueTest.findUnique({
        where: { code: 'ALPHA' },
      })

      expect(record).not.toBeNull()
      expect(record!.value).toBe(1)
    })

    // ============================================================
    // COMPOUND IDS
    // ============================================================

    test('create and find with compound id', async () => {
      const record = await prisma.compoundId.create({
        data: {
          tenantId: 'tenant-1',
          itemId: 'item-1',
          data: 'compound id test',
        },
      })

      expect(record.tenantId).toBe('tenant-1')
      expect(record.itemId).toBe('item-1')

      const found = await prisma.compoundId.findUnique({
        where: {
          tenantId_itemId: {
            tenantId: 'tenant-1',
            itemId: 'item-1',
          },
        },
      })

      expect(found).not.toBeNull()
      expect(found!.data).toBe('compound id test')
    })

    // ============================================================
    // BOUNDARY VALUES
    // ============================================================

    test('max/min Int values', async () => {
      const record = await prisma.typeTest.create({
        data: {
          boolVal: true,
          intVal: 2147483647,
          bigIntVal: BigInt('9223372036854775807'),
          floatVal: Number.MAX_SAFE_INTEGER,
          strVal: 'max values',
          dateVal: new Date(),
          jsonVal: {},
        },
      })

      expect(record.intVal).toBe(2147483647)
    })

    test('empty JSON object and array', async () => {
      const record = await prisma.typeTest.create({
        data: {
          boolVal: false,
          intVal: 0,
          bigIntVal: BigInt(0),
          floatVal: 0.0,
          strVal: 'json test',
          dateVal: new Date(),
          jsonVal: {},
        },
      })

      expect(record.jsonVal).toEqual({})
    })

    // ============================================================
    // CLEANUP
    // ============================================================

    afterAll(async () => {
      await prisma.typeTest.deleteMany()
      await prisma.uniqueTest.deleteMany()
      await prisma.compoundId.deleteMany()
    })
  },
  {
    optOut: {
      from: ['sqlite', 'postgresql', 'mysql', 'mongodb', 'cockroachdb', 'sqlserver'],
      reason: 'SurrealDB-only type test suite',
    },
  },
)
