import { getQueryEngineProtocol } from '@prisma/internals'
import path from 'path'

import { getTestClient } from '../../../../utils/getTestClient'
import { tearDownPostgres } from '../../../../utils/setupPostgres'
import { migrateDb } from '../../__helpers__/migrateDb'

// We WANT to be able to do the async function without an await
/* eslint-disable @typescript-eslint/require-await */

const testIf = (condition: boolean) => (condition ? test : test.skip)

beforeAll(async () => {
  process.env.TEST_POSTGRES_URI += '-wrong-native-types-tests'
  await tearDownPostgres(process.env.TEST_POSTGRES_URI!)
  await migrateDb({
    connectionString: process.env.TEST_POSTGRES_URI!,
    schemaPath: path.join(__dirname, 'schema.prisma'),
  })
})

testIf(getQueryEngineProtocol() !== 'json')(
  'wrong-native-types-postgres A: Integer, SmallInt, BigInt, Serial, SmallSerial, BigSerial',
  async () => {
    const PrismaClient = await getTestClient()

    const prisma = new PrismaClient({ errorFormat: 'minimal' })

    await prisma.a.deleteMany()

    const data = {
      email: 'a@a.de',
      name: 'Bob',
      int: '',
      sInt: '',
      bInt: 12312312.123,
    }

    await expect(async () =>
      prisma.a.create({
        data,
        select: {
          email: true,
          name: true,
          int: true,
          sInt: true,
          bInt: true,
        },
      }),
    ).rejects.toThrowErrorMatchingInlineSnapshot(`
          Argument int: Got invalid value '' on prisma.createOneA. Provided String, expected Int.
          Argument sInt: Got invalid value '' on prisma.createOneA. Provided String, expected Int.
          Argument bInt: Got invalid value 12312312.123 on prisma.createOneA. Provided Float, expected BigInt.

        `)

    await prisma.$disconnect()
  },
)

testIf(getQueryEngineProtocol() !== 'json')(
  'wrong-native-types-postgres B: Real, DoublePrecision, Decimal, Numeric',
  async () => {
    const PrismaClient = await getTestClient()

    const prisma = new PrismaClient({ errorFormat: 'minimal' })

    await prisma.b.deleteMany()

    const data: any = {
      float: '1.23',
      dFloat: '5.2',
      decFloat: 'hello',
      numFloat: '1.1',
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
          Argument float: Got invalid value '1.23' on prisma.createOneB. Provided String, expected Float.
          Argument dFloat: Got invalid value '5.2' on prisma.createOneB. Provided String, expected Float.
          Argument decFloat: Got invalid value 'hello' on prisma.createOneB. Provided String, expected Decimal.

        `)

    await prisma.$disconnect()
  },
)

testIf(getQueryEngineProtocol() !== 'json')(
  'wrong-native-types-postgres C: Char, VarChar, Text, Bit, VarBit, Uuid',
  async () => {
    const PrismaClient = await getTestClient()

    const prisma = new PrismaClient({ errorFormat: 'minimal' })

    await prisma.c.deleteMany()

    const data = {
      char: 'hello',
      vChar: 'worl                    d',
      text: 'a texadasdt',
      bit: '100asdasdasd1',
      vBit: '10110123123123',
      uuid: '643547a7-9e32-4e63-a52c-2e229f301c622',
    }

    await expect(async () =>
      prisma.c.create({
        data,
        select: {
          char: true,
          vChar: true,
          text: true,
          bit: true,
          vBit: true,
          uuid: true,
        },
      }),
    ).rejects.toThrowErrorMatchingInlineSnapshot(`

          Invalid \`prisma.c.create()\` invocation:


          Error occurred during query execution:
          ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(Error { kind: ToSql(4), cause: Some(Error { kind: ConversionError("Unexpected character for bits input. Expected only 1 and 0."), original_code: None, original_message: None }) }), transient: false })
        `)

    await prisma.$disconnect()
  },
)

testIf(getQueryEngineProtocol() !== 'json')('wrong-native-types-postgres D: Boolean, Bytes, Json, JsonB', async () => {
  const PrismaClient = await getTestClient()

  const prisma = new PrismaClient({ errorFormat: 'minimal' })

  await prisma.d.deleteMany()

  const helloString = 'hello prisma ⚡️🚀'
  const data = {
    bool: 'true',
    byteA: helloString,
    json: { hello: 'world' },
    jsonb: { hello: 'world' },
    xml: 123,
  }

  await expect(async () =>
    prisma.d.create({
      data,
      select: {
        bool: true,
        byteA: true,
        json: true,
        jsonb: true,
        xml: true,
      },
    }),
  ).rejects.toThrowErrorMatchingInlineSnapshot(`
          Argument bool: Got invalid value 'true' on prisma.createOneD. Provided String, expected Boolean.
          Argument byteA: Got invalid value 'hello prisma ⚡️🚀' on prisma.createOneD. Provided String, expected Bytes.
          Argument xml: Got invalid value 123 on prisma.createOneD. Provided Int, expected String.

        `)

  await prisma.$disconnect()
})

testIf(getQueryEngineProtocol() !== 'json')('wrong-native-types-postgres E: Date, Time, Timestamp', async () => {
  const PrismaClient = await getTestClient()

  const prisma = new PrismaClient({ errorFormat: 'minimal' })

  await prisma.e.deleteMany()

  const data = {
    date: '2020-05-05T1628:33.983+03:0012312',
    time: '8020-05-05T16:28:33.983+03:0012312',
    ts: '22020-05-05T16:28:33.983+03:00',
  }

  await expect(async () =>
    prisma.e.create({
      data,
      select: {
        date: true,
        time: true,
        ts: true,
      },
    }),
  ).rejects.toThrowErrorMatchingInlineSnapshot(`
          Argument date: Got invalid value '2020-05-05T1628:33.983+03:0012312' on prisma.createOneE. Provided String, expected DateTime.
          Argument time: Got invalid value '8020-05-05T16:28:33.983+03:0012312' on prisma.createOneE. Provided String, expected DateTime.
          Argument ts: Got invalid value '22020-05-05T16:28:33.983+03:00' on prisma.createOneE. Provided String, expected DateTime.

        `)

  await prisma.$disconnect()
})
