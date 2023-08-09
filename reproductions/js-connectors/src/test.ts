// @ts-nocheck
import { PrismaClient } from '.prisma/client'
import { setImmediate, setTimeout } from 'node:timers/promises'
import type { Connector, Closeable } from '@jkomyno/prisma-js-connector-utils'

type Flavor = Connector['flavor']

export async function smokeTest(db: Connector & Closeable, prismaSchemaRelativePath: string) {
  // wait for the database pool to be initialized
  await setImmediate(0)

  // DEBUG='prisma:client:libraryEngine'
  const prisma = new PrismaClient({ jsConnector: db })

  console.log('[nodejs] connecting...')
  await prisma.$connect()
  console.log('[nodejs] connected')

  const test = new SmokeTest(prisma, db.flavor)

  // Note: these tests currently trigger a panic!
  await test.interactiveTransactions()
  await test.explicitTransaction()
  await test.testFindManyTypeTest()
  await test.testCreateAndDeleteChildParent()

  // Note: calling `engine.disconnect` won't actually close the database connection.
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

  // Close the database connection. This is required to prevent the process from hanging.
  console.log('[nodejs] closing database connection...')
  await db.close()
  console.log('[nodejs] closed database connection')

  process.exit(0)
}


class SmokeTest {
  constructor(private readonly prisma: PrismaClient, readonly flavor: Connector['flavor']) {}

  async explicitTransaction() {
    const [children, totalChildren] = await this.prisma.$transaction([
      this.prisma.child.findMany(),
      this.prisma.child.count(),
    ], {
      isolationLevel: 'Serializable',
    })

    console.log('[nodejs] children', JSON.stringify(children, null, 2))
    console.log('[nodejs] totalChildren', totalChildren)
  }

  async interactiveTransactions() {
    const author = await this.prisma.author.create({
      data: {
        name: 'Name 1',
      },
    })
    console.log('[nodejs] author', JSON.stringify(author, null, 2))

    const result = await this.prisma.$transaction(async tx => {
      await tx.author.deleteMany()
      await tx.post.deleteMany()

      const author = await tx.author.create({
        data: {
          name: 'Name 2 from transaction',
        },
      })
      const post = await tx.post.create({
        data: {
          title: 'Title from transaction',
          published: false,
          author: {
            connect: {
              id: author.id,
            }
          },
        },
      })
      return { author, post }
    })

    console.log('[nodejs] result', JSON.stringify(result, null, 2))
  }

  async testFindManyTypeTest() {
    await this.testFindManyTypeTestMySQL()
    await this.testFindManyTypeTestPostgres()
  }

  @withFlavor({ only: ['mysql'] })
  private async testFindManyTypeTestMySQL() {
    const resultSet = await this.prisma.type_test.findMany({
      select: {
        'tinyint_column': true,
        'smallint_column': true,
        'mediumint_column': true,
        'int_column': true,

        /**
         * Prisma Client fails to parse the `bigint` type with:
         * `TypeError: Do not know how to serialize a BigInt`.
         * Note that libquery is able to parse it correctly.
         */
        // 'bigint_column': true,
        
        'float_column': true,
        'double_column': true,
        'decimal_column': true,
        'boolean_column': true,
        'char_column': true,
        'varchar_column': true,
        'text_column': true,
        'date_column': true,
        'time_column': true,
        'datetime_column': true,
        'timestamp_column': true,
        'json_column': true,
        'enum_column': true,
        'binary_column': true,
        'varbinary_column': true,
        'blob_column': true
      }
    })
    console.log('[nodejs] findMany resultSet', JSON.stringify(resultSet, null, 2))
  
    return resultSet
  }

  @withFlavor({ only: ['postgres'] })
  private async testFindManyTypeTestPostgres() {
    const resultSet = await this.prisma.type_test.findMany({
      select: {
        'smallint_column': true,
        'int_column': true,
        'bigint_column': true,
        'float_column': true,
        'double_column': true,
        'decimal_column': true,
        'boolean_column': true,
        'char_column': true,
        'varchar_column': true,
        'text_column': true,
        'date_column': true,
        'time_column': true,
        'datetime_column': true,
        'timestamp_column': true,
        'json_column': true,
        'enum_column': true
      }
    })
    console.log('[nodejs] findMany resultSet', JSON.stringify(resultSet, null, 2))
  
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
        p: 'p1'
      }
    })
    console.log('[nodejs] resultDeleteMany', JSON.stringify(resultDeleteMany, null, 2))
  }
}

type WithFlavorInput
  = { only: Array<Flavor>, exclude?: never }
  | { exclude: Array<Flavor>, only?: never }

function withFlavor({ only, exclude }: WithFlavorInput) {
  return function decorator(originalMethod: () => any, _ctx: ClassMethodDecoratorContext<SmokeTest, () => unknown>) {
    return function replacement(this: SmokeTest) {
      if ((exclude || []).includes(this.flavor)) {
        console.log(`[nodejs::exclude] Skipping test '${originalMethod.name}' with flavor: ${this.flavor}`)
        return
      }

      if ((only || []).length > 0 && !(only || []).includes(this.flavor)) {
        console.log(`[nodejs::only] Skipping test '${originalMethod.name}' with flavor: ${this.flavor}`)
        return
      }

      return originalMethod.call(this)
    }
  }
}
