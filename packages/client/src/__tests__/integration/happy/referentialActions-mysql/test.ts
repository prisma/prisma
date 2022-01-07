import path from 'path'
import { generateTestClient } from '../../../../utils/getTestClient'
import { tearDownMysql } from '../../../../utils/setupMysql'
import { migrateDb } from '../../__helpers__/migrateDb'

let prisma
const baseUri = process.env.TEST_MYSQL_URI

const fooCreate = {
  data: {
    name: 'Foo',
    mandatoryChildren: {
      create: [{ name: 'Foo 1' }, { name: 'Foo 2' }],
    },
  },
}
const barCreate = {
  data: {
    name: 'Bar',
    mandatoryChildren: {
      create: [{ name: 'Bar 1' }, { name: 'Bar 2' }],
    },
  },
}
const barDelete = {
  where: {
    name: 'Bar',
  },
}
const fooUpdate = {
  data: {
    id: 999,
  },
  where: {
    name: 'Foo',
  },
}
const fooFindUnique = {
  where: {
    name: 'Foo',
  },
  include: {
    mandatoryChildren: true,
  },
}

describe('referentialActions(mysql)', () => {
  beforeAll(async () => {
    process.env.TEST_MYSQL_URI += '-referentialActions'
    await tearDownMysql(process.env.TEST_MYSQL_URI!)
    await migrateDb({
      connectionString: process.env.TEST_MYSQL_URI!,
      schemaPath: path.join(__dirname, 'schema.prisma'),
    })
    await generateTestClient()
    const { PrismaClient } = require('./node_modules/@prisma/client')
    prisma = new PrismaClient({
      errorFormat: 'minimal',
    })
  })

  afterAll(async () => {
    await prisma.$disconnect()
    process.env.TEST_MYSQL_URI = baseUri
  })

  test('defaults', async () => {
    await prisma.defaultsParent.create(fooCreate)
    await prisma.defaultsParent.create(barCreate)

    // Confirm expected data got created
    expect(await prisma.defaultsParent.findMany()).toHaveLength(2)
    expect(await prisma.defaultsMandatoryChild.findMany()).toHaveLength(4)
    expect(
      await prisma.defaultsParent.findMany({
        include: {
          mandatoryChildren: true,
        },
      }),
    ).toMatchInlineSnapshot(`
      Array [
        Object {
          id: 2,
          mandatoryChildren: Array [
            Object {
              id: 3,
              name: Bar 1,
              parentId: 2,
            },
            Object {
              id: 4,
              name: Bar 2,
              parentId: 2,
            },
          ],
          name: Bar,
        },
        Object {
          id: 1,
          mandatoryChildren: Array [
            Object {
              id: 1,
              name: Foo 1,
              parentId: 1,
            },
            Object {
              id: 2,
              name: Foo 2,
              parentId: 1,
            },
          ],
          name: Foo,
        },
      ]
    `)

    // Delete
    try {
      await prisma.defaultsParent.delete(barDelete)
    } catch (e) {
      expect(e.message).toMatchInlineSnapshot(`Foreign key constraint failed on the field: \`parentId\``)
    }

    // Confirm delete got prevented
    expect(await prisma.defaultsParent.findMany()).toHaveLength(2)
    expect(await prisma.defaultsMandatoryChild.findMany()).toHaveLength(4)

    // Update
    await prisma.defaultsParent.update(fooUpdate)

    // Confirm update cascaded
    const foo = await prisma.defaultsParent.findUnique(fooFindUnique)
    expect(foo).toHaveProperty('id', 999)
    expect(foo.mandatoryChildren).toHaveLength(2)
    expect(foo).toMatchInlineSnapshot(`
      Object {
        id: 999,
        mandatoryChildren: Array [
          Object {
            id: 1,
            name: Foo 1,
            parentId: 999,
          },
          Object {
            id: 2,
            name: Foo 2,
            parentId: 999,
          },
        ],
        name: Foo,
      }
    `)

    // Confirm nothing got deleted
    expect(await prisma.defaultsParent.findMany()).toHaveLength(2)
    expect(await prisma.defaultsMandatoryChild.findMany()).toHaveLength(4)
  })

  test('onDelete: Cascade', async () => {
    await prisma.onDeleteCascadeParent.create(fooCreate)
    await prisma.onDeleteCascadeParent.create(barCreate)

    expect(await prisma.onDeleteCascadeParent.findMany()).toHaveLength(2)
    expect(await prisma.onDeleteCascadeMandatoryChild.findMany()).toHaveLength(4)

    await prisma.onDeleteCascadeParent.delete(barDelete)

    expect(await prisma.onDeleteCascadeParent.findMany()).toHaveLength(1)
    expect(await prisma.onDeleteCascadeMandatoryChild.findMany()).toHaveLength(2)

    // TODO Update
  })
})
