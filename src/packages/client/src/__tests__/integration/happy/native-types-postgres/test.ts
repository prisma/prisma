import { omit } from '../../../../omit'
import { pick } from '../../../../pick'
import { getTestClient } from '../../../../utils/getTestClient'
import path from 'path'
import { migrateDb } from '../../__helpers__/migrateDb'
import Decimal from 'decimal.js'

beforeAll(async () => {
  process.env.TEST_POSTGRES_URI += '-native-types-tests'
  await migrateDb({
    connectionString: process.env.TEST_POSTGRES_URI!,
    schemaPath: path.join(__dirname, 'schema.prisma')
  })
})

test('native-types-postgres A: Integer, SmallInt, BigInt, Serial, SmallSerial, BigSerial', async () => {
  const PrismaClient = await getTestClient()

  const prisma = new PrismaClient()

  await prisma.a.deleteMany()

  const data = {
    email: 'a@a.de',
    name: 'Bob',
    int: 1,
    sInt: 3,
    bInt: 12312312,
  }

  const a = await prisma.a.create({
    data,
    select: {
      email: true,
      name: true,
      int: true,
      sInt: true,
      bInt: true,
      serial: true,
      sSerial: true,
      bSerial: true,
      inc_int: true,
      inc_sInt: true,
      inc_bInt: true,
    },
  })

  const fixKeys = ['email', 'name', 'int', 'sInt', 'bInt']
  const fixData = pick(a, fixKeys)
  const dynamicData = omit(a, fixKeys)
  expect(fixData).toMatchInlineSnapshot(`
    Object {
      bInt: 12312312,
      email: a@a.de,
      int: 1,
      name: Bob,
      sInt: 3,
    }
  `)

  // as serials are increasing all the time and can't easily be reset
  // by "deleteMany", we're just checking, if the serials are there and if they're
  // bigger than 0

  for (let key in dynamicData) {
    expect(dynamicData[key]).toBeGreaterThan(0)
  }

  prisma.$disconnect()
})

test('native-types-postgres B: Real, DoublePrecision, Decimal, Numeric', async () => {
  const PrismaClient = await getTestClient()

  const prisma = new PrismaClient()

  await prisma.b.deleteMany()

  let data: any = {
    float: 1.2,
    dfloat: 1.3,
    decFloat: 1.23,
    numFloat: '23.12',
  }

  let b = await prisma.b.create({
    data,
    select: {
      float: true,
      dfloat: true,
      decFloat: true,
      numFloat: true,
    },
  })

  expect(Decimal.isDecimal(b.float)).toBe(false)
  expect(Decimal.isDecimal(b.dfloat)).toBe(false)
  expect(Decimal.isDecimal(b.decFloat)).toBe(true)
  expect(Decimal.isDecimal(b.numFloat)).toBe(true)


  expect(b).toMatchInlineSnapshot(`
    Object {
      decFloat: 1.2,
      dfloat: 1.3,
      float: 1.2000001,
      numFloat: 23.12,
    }
  `)

  data = {
    float: 1,
    dfloat: 1.3,
    decFloat: new Decimal('1.2'),
    numFloat: new Decimal('1232.123456')
  }

  b = await prisma.b.create({
    data,
    select: {
      float: true,
      dfloat: true,
      decFloat: true,
      numFloat: true,
    },
  })

  expect(b).toEqual(data)

  prisma.$disconnect()
})

test('native-types-postgres C: Char, VarChar, Text, Bit, VarBit, Uuid', async () => {
  const PrismaClient = await getTestClient()

  const prisma = new PrismaClient()

  await prisma.c.deleteMany()

  const data = {
    char: 'hello',
    vChar: 'world',
    text: 'a text',
    bit: '1001',
    vBit: '10110',
    uuid: '643547a7-9e32-4e63-a52c-2e229f301c62',
  }

  const c = await prisma.c.create({
    data,
    select: {
      char: true,
      vChar: true,
      text: true,
      bit: true,
      vBit: true,
      uuid: true,
    },
  })

  expect(c).toMatchInlineSnapshot(`
    Object {
      bit: 1001,
      char: hello     ,
      text: a text,
      uuid: 643547a7-9e32-4e63-a52c-2e229f301c62,
      vBit: 10110,
      vChar: world,
    }
  `)

  prisma.$disconnect()
})

test('native-types-postgres D: Boolean, Bytes, Json, JsonB', async () => {
  const PrismaClient = await getTestClient()

  const prisma = new PrismaClient()

  await prisma.d.deleteMany()

  const helloString = 'hello prisma ⚡️🚀'
  const data = {
    bool: true,
    byteA: Buffer.from(helloString),
    json: { hello: 'world' },
    jsonb: { hello: 'world' },
    xml: ''
  }
  const d = await prisma.d.create({
    data,
    select: {
      bool: true,
      byteA: true,
      json: true,
      jsonb: true,
      xml: true
    },
  })

  expect(Buffer.isBuffer(d.byteA)).toBe(true)

  expect(d).toEqual(data)

  prisma.$disconnect()
})

test('native-types-postgres E: Date, Time, Timestamp', async () => {
  const PrismaClient = await getTestClient()

  const prisma = new PrismaClient()

  await prisma.e.deleteMany()

  const data = {
    date: new Date('2020-05-05T16:28:33.983Z'),
    time: new Date('2020-05-02T16:28:33.983Z'),
    ts: '2020-05-05T16:28:33.983+03:00',
  }

  const e = await prisma.e.create({
    data,
    select: {
      date: true,
      time: true,
      ts: true,
    },
  })

  expect(e).toMatchInlineSnapshot(`
    Object {
      date: 2020-05-05T00:00:00.000Z,
      time: 1970-01-01T16:28:33.983Z,
      ts: 2020-05-05T13:28:33.983Z,
    }
  `)

  prisma.$disconnect()
})
