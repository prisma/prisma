import path from 'node:path'

import { getTestClient } from '../../../../utils/getTestClient'
import { tearDownPostgres } from '../../../../utils/setupPostgres'
import { migrateDb } from '../../__helpers__/migrateDb'

// We WANT to be able to do the async function without an await
/* eslint-disable @typescript-eslint/require-await */

beforeAll(async () => {
  process.env.DATABASE_URL = process.env.TEST_POSTGRES_URI!.replace('tests', 'tests-wrong-native-types-tests')
  await tearDownPostgres(process.env.DATABASE_URL)
  await migrateDb({
    schemaPath: path.join(__dirname, 'schema.prisma'),
  })
})

test('wrong-native-types-postgres A: Integer, SmallInt, BigInt, Serial, SmallSerial, BigSerial', async () => {
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

    Invalid \`prisma.a.create()\` invocation:

    {
      data: {
        email: "a@a.de",
        name: "Bob",
        int: "",
             ~~
        sInt: "",
        bInt: 12312312.123
      },
      select: {
        email: true,
        name: true,
        int: true,
        sInt: true,
        bInt: true
      }
    }

    Argument \`int\`: Invalid value provided. Expected Int, provided String.
  `)

  await prisma.$disconnect()
})

test('wrong-native-types-postgres B: Real, DoublePrecision, Decimal, Numeric', async () => {
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

    Invalid \`prisma.b.create()\` invocation:

    {
      data: {
        float: "1.23",
               ~~~~~~
        dFloat: "5.2",
        decFloat: "hello",
        numFloat: "1.1"
      },
      select: {
        float: true,
        dFloat: true,
        decFloat: true,
        numFloat: true
      }
    }

    Argument \`float\`: Invalid value provided. Expected Float, provided String.
  `)

  await prisma.$disconnect()
})

test('wrong-native-types-postgres C: Char, VarChar, Text, Bit, VarBit, Uuid', async () => {
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
})

test('wrong-native-types-postgres D: Boolean, Bytes, Json, JsonB', async () => {
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

    Invalid \`prisma.d.create()\` invocation:

    {
      data: {
        bool: "true",
              ~~~~~~
        byteA: "hello prisma ⚡️🚀",
        json: {
          hello: "world"
        },
        jsonb: {
          hello: "world"
        },
        xml: 123
      },
      select: {
        bool: true,
        byteA: true,
        json: true,
        jsonb: true,
        xml: true
      }
    }

    Argument \`bool\`: Invalid value provided. Expected Boolean, provided String.
  `)

  await prisma.$disconnect()
})

test('wrong-native-types-postgres E: Date, Time, Timestamp', async () => {
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

    Invalid \`prisma.e.create()\` invocation:

    {
      data: {
        date: "2020-05-05T1628:33.983+03:0012312",
              ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        time: "8020-05-05T16:28:33.983+03:0012312",
        ts: "22020-05-05T16:28:33.983+03:00"
      },
      select: {
        date: true,
        time: true,
        ts: true
      }
    }

    Invalid value for argument \`date\`: input contains invalid characters. Expected ISO-8601 DateTime.
  `)

  await prisma.$disconnect()
})
