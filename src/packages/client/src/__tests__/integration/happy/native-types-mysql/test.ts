import { getTestClient } from '../../../../utils/getTestClient'
import path from 'path'
import { migrateDb } from '../../__helpers__/migrateDb'
import Decimal from 'decimal.js'
import { tearDownMysql } from '../../../../utils/setupMysql'

beforeAll(async () => {
  process.env.TEST_MYSQL_URI += '-native-types'
  await tearDownMysql(process.env.TEST_MYSQL_URI!)
  await migrateDb({
    connectionString: process.env.TEST_MYSQL_URI!,
    schemaPath: path.join(__dirname, 'schema.prisma'),
  })
})

test('native-types-mysql A: Int, SmallInt, TinyInt, MediumInt, BigInt', async () => {
  const PrismaClient = await getTestClient()

  const prisma = new PrismaClient()

  await prisma.a.deleteMany()

  const data = {
    int: 123,
    sInt: 12,
    tInt: true,
    mInt: 100,
    bInt: BigInt(123123123),
  }

  const e = await prisma.a.create({
    data,
    select: {
      int: true,
      sInt: true,
      mInt: true,
      bInt: true,
      tInt: true,
    },
  })

  expect(e).toEqual(data)

  prisma.$disconnect()
})

test('native-types-mysql B: Float, Double, Decimal, Numeric', async () => {
  const PrismaClient = await getTestClient()

  const prisma = new PrismaClient()

  await prisma.b.deleteMany()

  let data: any = {
    float: 12.2,
    dFloat: 10.2,
    decFloat: 1.1,
    numFloat: '5.6',
  }

  let b = await prisma.b.create({
    data,
    select: {
      float: true,
      dFloat: true,
      decFloat: true,
      numFloat: true,
    },
  })

  expect(Decimal.isDecimal(b.float)).toBe(false)
  expect(Decimal.isDecimal(b.dFloat)).toBe(false)
  expect(Decimal.isDecimal(b.decFloat)).toBe(true)
  expect(Decimal.isDecimal(b.numFloat)).toBe(true)

  expect(b).toMatchInlineSnapshot(`
    Object {
      dFloat: 10.2,
      decFloat: 1.1,
      float: 12.2,
      numFloat: 5.6,
    }
  `)

  data = {
    float: 12.2,
    dFloat: 10.2,
    decFloat: new Decimal(1.1),
    numFloat: new Decimal('5.6'),
  }

  b = await prisma.b.create({
    data,
    select: {
      float: true,
      dFloat: true,
      decFloat: true,
      numFloat: true,
    },
  })

  expect(data).toEqual(b)

  prisma.$disconnect()
})

test('native-types-mysql C: Char, VarChar, TinyText, Text, MediumText, LongText', async () => {
  const PrismaClient = await getTestClient()

  const prisma = new PrismaClient()

  await prisma.c.deleteMany()

  const data = {
    char: 'f0f0f0f0f0',
    vChar: '12345678901',
    tText: 'f'.repeat(255),
    text: 'l'.repeat(65_000),
    mText: '🥳'.repeat(70_000),
    lText: '🔥'.repeat(80_000),
  }

  const c = await prisma.c.create({
    data,
    select: {
      char: true,
      vChar: true,
      tText: true,
      mText: true,
      text: true,
      lText: true,
    },
  })

  expect(c).toEqual(data)

  prisma.$disconnect()
})

test('native-types-mysql D: Date, Time, Datetime, Timestamp, Year', async () => {
  const PrismaClient = await getTestClient()

  const prisma = new PrismaClient()

  await prisma.d.deleteMany()

  const data = {
    date: new Date('2020-05-05T16:28:33.983Z'),
    time: new Date('2020-05-02T16:28:33.983Z'),
    dtime: new Date('2020-05-02T16:28:33.983Z'),
    ts: '2020-05-05T16:28:33.983+03:00',
    year: 2020,
  }

  const d = await prisma.d.create({
    data,
    select: {
      date: true,
      time: true,
      dtime: true,
      ts: true,
      year: true,
    },
  })

  expect(data).toMatchInlineSnapshot(`
    Object {
      date: 2020-05-05T16:28:33.983Z,
      dtime: 2020-05-02T16:28:33.983Z,
      time: 2020-05-02T16:28:33.983Z,
      ts: 2020-05-05T16:28:33.983+03:00,
      year: 2020,
    }
  `)

  prisma.$disconnect()
})

test('native-types-mysql E: Bit, Binary, VarBinary, Blob, TinyBlob, MediumBlob, LongBlob', async () => {
  const PrismaClient = await getTestClient()

  const prisma = new PrismaClient()

  await prisma.e.deleteMany()

  const data = {
    bit: Buffer.from([0x62]),
    bin: Buffer.from('1234'),
    vBin: Buffer.from('12345'),
    blob: Buffer.from('hi'),
    tBlob: Buffer.from('tbob'),
    mBlob: Buffer.from('mbob'),
    lBlob: Buffer.from('longbob'),
  }

  const e = await prisma.e.create({
    data,
    select: {
      bit: true,
      bin: true,
      vBin: true,
      blob: true,
      tBlob: true,
      mBlob: true,
      lBlob: true,
    },
  })

  expect(e).toEqual(data)

  prisma.$disconnect()
})
