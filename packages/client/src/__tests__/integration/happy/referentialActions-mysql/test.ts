import path from 'path'
import { generateTestClient } from '../../../../utils/getTestClient'
import { tearDownMysql } from '../../../../utils/setupMysql'
import { migrateDb } from '../../__helpers__/migrateDb'

let prisma
const baseUri = process.env.TEST_MYSQL_URI

const fooCreate = {
  data: {
    name: 'FooParent',
    mandatoryChildren: {
      create: [{ name: 'FooChild 1' }, { name: 'FooChild 2' }],
    },
  },
}
const barCreate = {
  data: {
    name: 'BarParent',
    mandatoryChildren: {
      create: [{ name: 'BarChild 1' }, { name: 'BarChild 2' }],
    },
  },
}
const barParentDelete = {
  where: {
    name: 'BarParent',
  },
}
const fooParentUpdate = {
  data: {
    id: 999,
  },
  where: {
    name: 'FooParent',
  },
}
const fooParentFindUnique = {
  where: {
    name: 'FooParent',
  },
  include: {
    mandatoryChildren: true,
  },
}
const barChildrenFind = {
  where: {
    name: {
      startsWith: 'BarChild',
    },
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
      log: [
        {
          emit: 'event',
          level: 'query',
        },
      ],
    })
    prisma.$on('query', (e) => {
      console.log('Query: ' + e.query)
      console.log('Params: ' + e.params)
    })
  })

  afterAll(async () => {
    await prisma.$disconnect()
    process.env.TEST_MYSQL_URI = baseUri
  })

  async function seedData(parentModel) {
    await prisma[parentModel].create(fooCreate)
    await prisma[parentModel].create(barCreate)
  }

  async function confirmDeleteCascaded(parentModel, mandatoryChildModel) {
    expect(await prisma[parentModel].findMany()).toHaveLength(1)
    expect(await prisma[mandatoryChildModel].findMany()).toHaveLength(2)
  }

  async function confirmDeleteNotCascaded(parentModel, mandatoryChildModel) {
    expect(await prisma[parentModel].findMany()).toHaveLength(1)
    expect(await prisma[mandatoryChildModel].findMany()).toHaveLength(4)
  }

  async function confirmSeed(parentModel, mandatoryChildModel) {
    expect(await prisma[parentModel].findMany()).toHaveLength(2)
    expect(await prisma[mandatoryChildModel].findMany()).toHaveLength(4)
    expect(
      await prisma[parentModel].findMany({
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
              name: BarChild 1,
              parentId: 2,
            },
            Object {
              id: 4,
              name: BarChild 2,
              parentId: 2,
            },
          ],
          name: BarParent,
        },
        Object {
          id: 1,
          mandatoryChildren: Array [
            Object {
              id: 1,
              name: FooChild 1,
              parentId: 1,
            },
            Object {
              id: 2,
              name: FooChild 2,
              parentId: 1,
            },
          ],
          name: FooParent,
        },
      ]
    `)
  }

  async function confirmUpdateCascaded(parentModel) {
    const foo = await prisma[parentModel].findUnique(fooParentFindUnique)
    expect(foo).toHaveProperty('id', 999)
    expect(foo.mandatoryChildren).toHaveLength(2)
    expect(foo).toMatchInlineSnapshot(`
      Object {
        id: 999,
        mandatoryChildren: Array [
          Object {
            id: 1,
            name: FooChild 1,
            parentId: 999,
          },
          Object {
            id: 2,
            name: FooChild 2,
            parentId: 999,
          },
        ],
        name: FooParent,
      }
    `)
  }

  async function confirmDeleteSetNull(mandatoryChildModel) {
    const bar = await prisma[mandatoryChildModel].findMany(barChildrenFind)
    expect(bar).toMatchInlineSnapshot(`
      Array [
        Object {
          id: 3,
          name: BarChild 1,
          parentId: null,
        },
        Object {
          id: 4,
          name: BarChild 2,
          parentId: null,
        },
      ]
    `)
  }

  async function confirmDeleteSetDefault(mandatoryChildModel) {
    const bar = await prisma[mandatoryChildModel].findMany(barChildrenFind)
    expect(bar).toHaveProperty('id', 999)
    expect(bar.mandatoryChildren).toHaveLength(2)
    expect(bar).toMatchInlineSnapshot(`
      Object {
        id: 999,
        mandatoryChildren: Array [
          Object {
            id: 1,
            name: FooChild 1,
            parentId: 999,
          },
          Object {
            id: 2,
            name: FooChild 2,
            parentId: 999,
          },
        ],
        name: FooParent,
      }
    `)
  }

  async function seed(parentModel, mandatoryChildModel) {
    await seedData(parentModel)
    await confirmSeed(parentModel, mandatoryChildModel)
  }

  // TODO Expand to also include optional relation

  /*
  Clause	  Optional relations	Mandatory relations
  onDelete	SetNull	            Restrict
  onUpdate	Cascade	            Cascade
                                  ^^
  */
  async function testDefaults(parentModel, mandatoryChildModel) {
    await seed(parentModel, mandatoryChildModel)

    try {
      await prisma[parentModel].delete(barParentDelete)
    } catch (e) {
      expect(e.message).toMatchInlineSnapshot(`Foreign key constraint failed on the field: \`parentId\``)
    }
    await confirmSeed(parentModel, mandatoryChildModel)

    await prisma[parentModel].update(fooParentUpdate)
    await confirmUpdateCascaded(parentModel)
  }

  test('defaults', async () => {
    const parentModel = 'defaultsParent'
    const mandatoryChildModel = 'defaultsMandatoryChild'
    await testDefaults(parentModel, mandatoryChildModel)
  })

  test('onDelete: Cascade', async () => {
    const parentModel = 'onDeleteCascadeParent'
    const mandatoryChildModel = 'onDeleteCascadeMandatoryChild'
    await seed(parentModel, mandatoryChildModel)

    await prisma[parentModel].delete(barParentDelete)
    await confirmDeleteCascaded(parentModel, mandatoryChildModel)

    await prisma[parentModel].update(fooParentUpdate)
    await confirmUpdateCascaded(parentModel)

    await confirmDeleteCascaded(parentModel, mandatoryChildModel)
  })

  // Identical to Default here!
  test('onDelete: Restrict', async () => {
    const parentModel = 'onDeleteRestrictParent'
    const mandatoryChildModel = 'onDeleteRestrictMandatoryChild'
    await testDefaults(parentModel, mandatoryChildModel)
  })

  // Identical to Default here!
  test('onDelete: NoAction', async () => {
    const parentModel = 'onDeleteNoActionParent'
    const mandatoryChildModel = 'onDeleteNoActionMandatoryChild'
    await testDefaults(parentModel, mandatoryChildModel)
  })

  test('onDelete: SetNull', async () => {
    const parentModel = 'onDeleteSetNullParent'
    const mandatoryChildModel = 'onDeleteSetNullMandatoryChild'
    await seed(parentModel, mandatoryChildModel)

    await prisma[parentModel].delete(barParentDelete)
    await confirmDeleteNotCascaded(parentModel, mandatoryChildModel)
    await confirmDeleteSetNull(mandatoryChildModel)

    await prisma[parentModel].update(fooParentUpdate)
    await confirmUpdateCascaded(parentModel)

    await confirmDeleteNotCascaded(parentModel, mandatoryChildModel)
  })

  /*
  // Not supported: https://github.com/prisma/prisma/issues/11498
  test('onDelete: SetDefault', async () => {
    const parentModel = 'onDeleteSetDefaultParent'
    const mandatoryChildModel = 'onDeleteSetDefaultMandatoryChild'
    await seed(parentModel, mandatoryChildModel)

    await prisma[parentModel].delete(barParentDelete)
    await confirmDeleteNoCascade(parentModel, mandatoryChildModel)
    await confirmDeleteSetDefault(mandatoryChildModel)

    await prisma[parentModel].update(fooParentUpdate)
    await confirmUpdateCascaded(parentModel)

    await confirmDeleteNoCascade(parentModel, mandatoryChildModel)
  })
  */
})
