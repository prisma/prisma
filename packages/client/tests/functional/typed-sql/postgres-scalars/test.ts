import { faker } from '@faker-js/faker'
// @ts-ignore
import type * as Sql from '@prisma/client/sql'
import { expectTypeOf } from 'expect-type'

import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient
declare let Prisma: typeof PrismaNamespace
declare let sql: typeof Sql

const id = '1234'
const bigInt = BigInt('12345')
const dateTime = new Date('2024-07-31T14:37:36.570Z')
const date = new Date('2024-07-31T00:00:00.000Z')
const time = new Date('1970-01-01T14:37:36.570Z')
const uuid = faker.string.uuid()
testMatrix.setupTestSuite(
  () => {
    beforeAll(async () => {
      await prisma.testModel.create({
        data: {
          id,
          int: 123,
          real: 12.3,
          double: 12.3,
          bool: true,
          string: 'hello',
          xml: '<hello />',
          enum: 'ONE',
          json: { hello: 'world' },
          uuid,
          bigInt,
          dateTime,
          date,
          time,
          bytes: Uint8Array.of(1, 2, 3),
          decimal: new Prisma.Decimal('12.34'),
        },
      })
    })
    test('int - output', async () => {
      const result = await prisma.$queryRawTyped(sql.getInt(id))
      expect(result[0].int).toBe(123)
      expectTypeOf(result[0].int).toBeNumber()
    })

    test('int - input', async () => {
      const result = await prisma.$queryRawTyped(sql.findInt(123))
      expect(result[0].id).toBe(id)
    })

    test('real - output', async () => {
      const result = await prisma.$queryRawTyped(sql.getReal(id))
      expect(result[0].real).toBe(12.3)
      expectTypeOf(result[0].real).toBeNumber()
    })

    test('real - input', async () => {
      const result = await prisma.$queryRawTyped(sql.findReal(13))
      expect(result[0].id).toBe(id)
    })

    test('double - output', async () => {
      const result = await prisma.$queryRawTyped(sql.getDouble(id))
      expect(result[0].double).toBe(12.3)
      expectTypeOf(result[0].double).toBeNumber()
    })

    test('double - input', async () => {
      const result = await prisma.$queryRawTyped(sql.findDouble(12.3))
      expect(result[0].id).toBe(id)
    })

    test('string - output', async () => {
      const result = await prisma.$queryRawTyped(sql.getString(id))
      expect(result[0].string).toEqual('hello')
      expectTypeOf(result[0].string).toBeString()
    })

    test('string - input', async () => {
      const result = await prisma.$queryRawTyped(sql.findString('hello'))
      expect(result[0].id).toEqual(id)
    })

    test('enum - output', async () => {
      const result = await prisma.$queryRawTyped(sql.getEnum(id))
      expect(result[0].enum).toEqual('ONE')
      expectTypeOf(result[0].enum).toEqualTypeOf<'ONE' | 'TWO'>()
      expectTypeOf(result[0].enum).toEqualTypeOf<Sql.$DbEnums.Enum>()
    })

    test('enum - input', async () => {
      const result = await prisma.$queryRawTyped(sql.findEnum('ONE'))
      expect(result[0].id).toEqual(id)
    })

    test('BigInt - output', async () => {
      const result = await prisma.$queryRawTyped(sql.getBigInt(id))
      expect(result[0].bigInt).toEqual(bigInt)
      expectTypeOf(result[0].bigInt).toEqualTypeOf<bigint>()
    })

    test('BigInt - input', async () => {
      const numberResult = await prisma.$queryRawTyped(sql.findBigInt(12345))
      expect(numberResult[0].id).toEqual(id)

      const bigintResult = await prisma.$queryRawTyped(sql.findBigInt(bigInt))
      expect(bigintResult[0].id).toEqual(id)
    })

    test('DateTime - output', async () => {
      const result = await prisma.$queryRawTyped(sql.getDateTime(id))
      expect(result[0].dateTime).toEqual(dateTime)
      expectTypeOf(result[0].dateTime).toEqualTypeOf<Date>()
    })

    test('DateTime - input', async () => {
      const resultDate = await prisma.$queryRawTyped(sql.findDateTime(dateTime))
      expect(resultDate[0].id).toEqual(id)
    })

    test('Date - output', async () => {
      const result = await prisma.$queryRawTyped(sql.getDate(id))
      expect(result[0].date).toEqual(date)
      expectTypeOf(result[0].date).toEqualTypeOf<Date>()
    })

    test('Date - input', async () => {
      const resultDate = await prisma.$queryRawTyped(sql.findDate(date))
      expect(resultDate[0].id).toEqual(id)
    })

    test('Time - output', async () => {
      const result = await prisma.$queryRawTyped(sql.getTime(id))
      expect(result[0].time).toEqual(time)
      expectTypeOf(result[0].time).toEqualTypeOf<Date>()
    })

    test('Time - input', async () => {
      const resultDate = await prisma.$queryRawTyped(sql.findTime(time))
      expect(resultDate[0].id).toEqual(id)
    })

    test('Decimal - output', async () => {
      const result = await prisma.$queryRawTyped(sql.getDecimal(id))
      expect(result[0].decimal).toBeInstanceOf(Prisma.Decimal)
      expect(result[0].decimal).toEqual(new Prisma.Decimal('12.34'))
      expectTypeOf(result[0].decimal).toEqualTypeOf<PrismaNamespace.Decimal>()
    })

    test('Decimal - input', async () => {
      const resultDecimal = await prisma.$queryRawTyped(sql.findDecimal(new Prisma.Decimal('12.34')))
      expect(resultDecimal[0].id).toBe(id)

      const resultNumber = await prisma.$queryRawTyped(sql.findDecimal(12.34))
      expect(resultNumber[0].id).toBe(id)
    })

    test('xml - output', async () => {
      const result = await prisma.$queryRawTyped(sql.getXml(id))
      expect(result[0].xml).toEqual('<hello />')
      expectTypeOf(result[0].xml).toBeString()
    })

    test('xml - input', async () => {
      const result = await prisma.$queryRawTyped(sql.findXml('<world />'))
      expect(result[0].concatResult).toEqual('<hello /><world />')
    })

    test('uuid - output', async () => {
      const result = await prisma.$queryRawTyped(sql.getUuid(id))
      expect(result[0].uuid).toEqual(uuid)
      expectTypeOf(result[0].uuid).toBeString()
    })

    test('uuid - input', async () => {
      const result = await prisma.$queryRawTyped(sql.findUuid(uuid))
      expect(result[0].id).toEqual(id)
    })

    test('bytes - output', async () => {
      const result = await prisma.$queryRawTyped(sql.getBytes(id))
      expect(result[0].bytes).toEqual(Uint8Array.of(1, 2, 3))
      expectTypeOf(result[0].bytes).toEqualTypeOf<Uint8Array>()
    })

    test('bytes - input', async () => {
      const result = await prisma.$queryRawTyped(sql.findBytes(Uint8Array.of(1, 2, 3)))
      expect(result[0].id).toEqual(id)
    })

    test('json - output', async () => {
      const result = await prisma.$queryRawTyped(sql.getJson(id))
      expect(result[0].json).toEqual({ hello: 'world' })

      expectTypeOf(result[0].json).toEqualTypeOf<PrismaNamespace.JsonValue>()
    })
  },
  {
    optOut: {
      from: ['sqlite', 'mysql', 'mongodb', 'cockroachdb', 'sqlserver'],
      reason: 'Focusing on postgres only',
    },
  },
)
