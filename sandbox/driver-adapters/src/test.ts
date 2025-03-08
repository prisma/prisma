import superjson from 'superjson'
import { PrismaClient } from '.prisma/client'
import { setImmediate, setTimeout } from 'node:timers/promises'
import type { DriverAdapter } from '@prisma/driver-adapter-utils'

export async function smokeTest(adapter: DriverAdapter) {
  // wait for the database pool to be initialized
  await setImmediate(0)

  // DEBUG='prisma:client:libraryEngine'
  const prisma = new PrismaClient({ adapter })

  console.log('[nodejs] connecting...')
  await prisma.$connect()
  console.log('[nodejs] connected')

  const test = new SmokeTest(prisma, adapter.provider)

  await test.testJSON()
  await test.testTypeTest2()
  await test.$raw()
  await test.testFindManyTypeTest()
  await test.transactionsWithConflits()
  await test.testCreateAndDeleteChildParent()
  await test.interactiveTransactions()
  await test.explicitTransaction()

  console.log('[nodejs] disconnecting...')
  await prisma.$disconnect()
  console.log('[nodejs] disconnected')

  console.log('[nodejs] re-connecting...')
  await prisma.$connect()
  console.log('[nodejs] re-connecting')

  await setTimeout(0)

  console.log('[nodejs] re-disconnecting...')
  await prisma.$disconnect()
  console.log('[nodejs] re-disconnected')
}

class SmokeTest {
  constructor(
    private readonly prisma: PrismaClient,
    readonly provider: DriverAdapter['provider'],
  ) {}

  async testJSON() {
    const json = JSON.stringify({
      foo: 'bar',
      baz: 1,
    })

    const created = await this.prisma.product.create({
      data: {
        properties: json,
      },
      select: {
        properties: true,
      },
    })

    console.log('[nodejs] created', superjson.serialize(created).json)

    const resultSet = await this.prisma.product.findMany({})
    console.log('[nodejs] resultSet', superjson.serialize(resultSet).json)

    await this.prisma.product.deleteMany({})
  }

  async transactionsWithConflits() {
    await this.prisma.leak_test.deleteMany()

    const one = async () => {
      await this.prisma.$transaction(async (tx) => {
        await tx.leak_test.create({ data: {} })
        await setTimeout(1000)
        throw new Error('Abort the mission')
      })
    }

    const two = async () => {
      await setTimeout(500)
      await this.prisma.leak_test.create({ data: {} })
    }

    await this.prisma.leak_test.deleteMany()
    await Promise.allSettled([one(), two()])
  }

  async explicitTransaction() {
    const [children, totalChildren] = await this.prisma.$transaction(
      [this.prisma.child.findMany(), this.prisma.child.count()],
      {
        isolationLevel: 'Serializable',
      },
    )

    console.log('[nodejs] children', superjson.serialize(children).json)
    console.log('[nodejs] totalChildren', totalChildren)
  }

  async $raw() {
    const cleanUp = async () => {
      await this.prisma.$executeRaw`DELETE FROM leak_test`
    }

    await cleanUp()

    await this.prisma.$executeRaw`INSERT INTO leak_test (id) VALUES (1)`
    const result = await this.prisma.$queryRaw`SELECT * FROM leak_test`
    console.log('[nodejs] result', superjson.serialize(result).json)

    await cleanUp()
  }

  async interactiveTransactions() {
    const author = await this.prisma.author.create({
      data: {
        firstName: 'Firstname 1 from autoincrement',
        lastName: 'Lastname 1 from autoincrement',
        age: 99,
      },
    })
    console.log('[nodejs] author', superjson.serialize(author).json)

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.author.deleteMany()
      await tx.post.deleteMany()

      const author = await tx.author.create({
        data: {
          firstName: 'Firstname 2 from autoincrement',
          lastName: 'Lastname 2 from autoincrement',
          age: 100,
        },
      })
      const post = await tx.post.create({
        data: {
          title: 'Title from transaction',
          published: false,
          author: {
            connect: {
              id: author.id,
            },
          },
        },
      })
      return { author, post }
    })

    console.log('[nodejs] result', superjson.serialize(result).json)
  }

  async testTypeTest2() {
    const created = await this.prisma.type_test_2.create({
      data: {},
    })
    console.log('[nodejs] created', superjson.serialize(created).json)

    const resultSet = await this.prisma.type_test_2.findMany({})
    console.log('[nodejs] resultSet', superjson.serialize(resultSet).json)

    await this.prisma.type_test_2.deleteMany({})
  }

  async testFindManyTypeTest() {
    await this.testFindManyTypeTestMySQL()
    await this.testFindManyTypeTestPostgres()
  }

  private async testFindManyTypeTestMySQL() {
    if (this.provider !== 'mysql') {
      return
    }

    const resultSet = await this.prisma.type_test.findMany({
      select: {
        tinyint_column: true,
        smallint_column: true,
        mediumint_column: true,
        int_column: true,
        bigint_column: true,
        float_column: true,
        double_column: true,
        decimal_column: true,
        boolean_column: true,
        char_column: true,
        varchar_column: true,
        text_column: true,
        date_column: true,
        time_column: true,
        datetime_column: true,
        timestamp_column: true,
        json_column: true,
        enum_column: true,
        binary_column: true,
        varbinary_column: true,
        blob_column: true,
      },
    })
    console.log('[nodejs] findMany resultSet', superjson.serialize(resultSet).json)

    return resultSet
  }

  private async testFindManyTypeTestPostgres() {
    if (this.provider !== 'postgres') {
      return
    }

    const resultSet = await this.prisma.type_test.findMany({
      select: {
        smallint_column: true,
        int_column: true,
        bigint_column: true,
        float_column: true,
        double_column: true,
        decimal_column: true,
        boolean_column: true,
        char_column: true,
        varchar_column: true,
        text_column: true,
        date_column: true,
        time_column: true,
        datetime_column: true,
        timestamp_column: true,
        json_column: true,
        enum_column: true,
      },
    })
    console.log('[nodejs] findMany resultSet', superjson.serialize(resultSet).json)

    return resultSet
  }

  async testCreateAndDeleteChildParent() {
    /* Delete all child and parent records */

    await this.prisma.child.deleteMany()
    await this.prisma.parent.deleteMany()

    /* Create a parent with some new children */

    await this.prisma.child.create({
      data: {
        c: 'c1',
        c_1: 'foo',
        c_2: 'bar',
        id: '0001',
      },
    })

    await this.prisma.parent.create({
      data: {
        p: 'p1',
        p_1: '1',
        p_2: '2',
        id: '0001',
      },
    })

    /* Delete the parent */

    const resultDeleteMany = await this.prisma.parent.deleteMany({
      where: {
        p: 'p1',
      },
    })
    console.log('[nodejs] resultDeleteMany', superjson.serialize(resultDeleteMany).json)
  }
}
