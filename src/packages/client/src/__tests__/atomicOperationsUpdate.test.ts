import chalk from 'chalk'
import { blog } from '../fixtures/blog'
import { DMMFClass, makeDocument, transformDocument } from '../runtime'
import { getDMMF } from '../generation/getDMMF'
chalk.level = 0

let dmmf
describe('minimal where transformation', () => {
  beforeAll(async () => {
    dmmf = new DMMFClass(await getDMMF({ datamodel: blog }))
  })

  test('OR posts some id in', () => {
    function getTransformedDocument(select) {
      const document = makeDocument({
        dmmf,
        select,
        rootTypeName: 'mutation',
        rootField: 'updateOneUser',
      })
      return String(transformDocument(document))
    }

    const transformedDocument = getTransformedDocument({
      data: {
        countInt1: {
          set: null,
        },
        countInt2: {
          set: 123,
        },
        countInt3: {
          increment: 1,
        },
        countInt4: {
          decrement: 1,
        },
        countInt5: {
          multiply: 2,
        },
        countInt6: {
          divide: 4,
        },
      },
    })

    expect(transformedDocument).toMatchInlineSnapshot(`
      "mutation {
        updateOneUser(
          data: {
            countInt1: {
              set: null
            }
            countInt2: {
              set: 123
            }
            countInt3: {
              increment: 1
            }
            countInt4: {
              decrement: 1
            }
            countInt5: {
              multiply: 2
            }
            countInt6: {
              divide: 4
            }
          }
        ) {
          id
          email
          name
          json
          countInt1
          countInt2
          countInt3
          countInt4
          countInt5
          countInt6
        }
      }"
    `)
  })
})
