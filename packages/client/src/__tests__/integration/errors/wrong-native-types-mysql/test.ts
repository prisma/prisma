import { getQueryEngineProtocol } from '@prisma/internals'
import path from 'path'

import { getTestClient } from '../../../../utils/getTestClient'
import { tearDownMysql } from '../../../../utils/setupMysql'
import { migrateDb } from '../../__helpers__/migrateDb'

// We WANT to be able to do the async function without an await
/* eslint-disable @typescript-eslint/require-await */

const testIf = (condition: boolean) => (condition ? test : test.skip)

beforeAll(async () => {
  process.env.TEST_MYSQL_URI += '-wrong-native-types'
  await tearDownMysql(process.env.TEST_MYSQL_URI!)
  await migrateDb({
    connectionString: process.env.TEST_MYSQL_URI!,
    schemaPath: path.join(__dirname, 'schema.prisma'),
  })
})

testIf(getQueryEngineProtocol() !== 'json')(
  'wrong-native-types-mysql A: Int, SmallInt, TinyInt, MediumInt, BigInt',
  async () => {
    const PrismaClient = await getTestClient()

    const prisma = new PrismaClient({ errorFormat: 'minimal' })

    await prisma.a.deleteMany()

    const data = {
      int: 123,
      sInt: 12,
      tInt: 1,
      mInt: 100,
      bInt: 123123123.1,
    }

    await expect(async () =>
      prisma.a.create({
        data,
        select: {
          int: true,
          sInt: true,
          mInt: true,
          bInt: true,
          tInt: true,
        },
      }),
    ).rejects.toThrowErrorMatchingInlineSnapshot(`
          Argument tInt: Got invalid value 1 on prisma.createOneA. Provided Int, expected Boolean.
          Argument bInt: Got invalid value 123123123.1 on prisma.createOneA. Provided Float, expected BigInt.

        `)

    await prisma.$disconnect()
  },
)

testIf(getQueryEngineProtocol() !== 'json')('wrong-native-types-mysql B: Float, Double, Decimal, Numeric', async () => {
  const PrismaClient = await getTestClient()

  const prisma = new PrismaClient({ errorFormat: 'minimal' })

  await prisma.b.deleteMany()

  const data: any = {
    float: 12.2,
    dFloat: 10.2,
    decFloat: 1.1,
    numFloat: 'a5.6',
  }

  await expect(async () =>
    prisma.b.create({
      data,
      select: {
        float: true,
        dFloat: true,
        decFloat: true,
        numFloat: true,
      },
    }),
  ).rejects.toThrowErrorMatchingInlineSnapshot(`
          Argument numFloat: Got invalid value 'a5.6' on prisma.createOneB. Provided String, expected Decimal or Null.

        `)

  await prisma.$disconnect()
})

testIf(getQueryEngineProtocol() !== 'json')(
  'wrong-native-types-mysql C: Char, VarChar, TinyText, Text, MediumText, LongText',
  async () => {
    const PrismaClient = await getTestClient()

    const prisma = new PrismaClient({ errorFormat: 'minimal' })

    await prisma.c.deleteMany()

    const data = {
      char: 'f0f0f0f0f20',
      vChar: '123456789012',
      tText: 'f'.repeat(258),
      text: 'l'.repeat(70_000),
      mText: '🥳'.repeat(70_000),
      lText: '🔥'.repeat(80_000),
    }

    await expect(async () =>
      prisma.c.create({
        data,
        select: {
          char: true,
          vChar: true,
          tText: true,
          mText: true,
          text: true,
          lText: true,
        },
      }),
    ).rejects.toThrowErrorMatchingInlineSnapshot(`

          Invalid \`prisma.c.create()\` invocation:


          The provided value for the column is too long for the column's type. Column: char
        `)

    await prisma.$disconnect()
  },
)

testIf(getQueryEngineProtocol() !== 'json')(
  'wrong-native-types-mysql D: Date, Time, DateTime, Timestamp, Year',
  async () => {
    const PrismaClient = await getTestClient()

    const prisma = new PrismaClient({ errorFormat: 'minimal' })

    await prisma.d.deleteMany()

    const data = {
      date: new Date('2020-05-05T16:28:33.983Z'),
      time: new Date('2020-05-02T16:28:33.983Z'),
      dtime: new Date('2020-05-02T16:28:33.983Z'),
      ts: '2020-05-05T16:28:33.983+03:0012312',
      year: 'string',
    }

    await expect(async () =>
      prisma.d.create({
        data,
        select: {
          date: true,
          time: true,
          dtime: true,
          ts: true,
          year: true,
        },
      }),
    ).rejects.toThrowErrorMatchingInlineSnapshot(`
          Argument ts: Got invalid value '2020-05-05T16:28:33.983+03:0012312' on prisma.createOneD. Provided String, expected DateTime.
          Argument year: Got invalid value 'string' on prisma.createOneD. Provided String, expected Int.

        `)

    await prisma.$disconnect()
  },
)

testIf(getQueryEngineProtocol() !== 'json')(
  'wrong-native-types-mysql E: Bit, Binary, VarBinary, Blob, TinyBlob, MediumBlob, LongBlob',
  async () => {
    const PrismaClient = await getTestClient()

    const prisma = new PrismaClient({ errorFormat: 'minimal' })

    await prisma.e.deleteMany()

    const data = {
      bit: [0x62],
      bin: '1234',
      vBin: '12345',
      blob: 'hi',
      tBlob: 'tbob',
      mBlob: 'mbob',
      lBlob: 'longbob',
    }

    await expect(async () =>
      prisma.e.create({
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
      }),
    ).rejects.toThrowErrorMatchingInlineSnapshot(`
          Argument bit: Got invalid value 
          [
            98
          ]
          on prisma.createOneE. Provided List<Int>, expected Bytes.
          Argument bin: Got invalid value '1234' on prisma.createOneE. Provided String, expected Bytes.
          Argument vBin: Got invalid value '12345' on prisma.createOneE. Provided String, expected Bytes.
          Argument blob: Got invalid value 'hi' on prisma.createOneE. Provided String, expected Bytes.
          Argument tBlob: Got invalid value 'tbob' on prisma.createOneE. Provided String, expected Bytes.
          Argument mBlob: Got invalid value 'mbob' on prisma.createOneE. Provided String, expected Bytes.
          Argument lBlob: Got invalid value 'longbob' on prisma.createOneE. Provided String, expected Bytes.

        `)

    await prisma.$disconnect()
  },
)
