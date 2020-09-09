import chalk from 'chalk'
import { blog } from '../fixtures/blog'
import { DMMFClass, makeDocument, transformDocument } from '../../runtime'
import { getDMMF } from '../generation/getDMMF'
chalk.level = 0

let dmmf

function getTransformedDocument(select) {
  const document = makeDocument({
    dmmf,
    select,
    rootTypeName: 'mutation',
    rootField: 'updateOneUser',
  })
  return String(transformDocument(document))
}

describe('minimal atomic update transformation', () => {
  beforeAll(async () => {
    dmmf = new DMMFClass(await getDMMF({ datamodel: blog }))
  })

  test('atomic set operation without object wrapping', () => {
    const transformedDocument = getTransformedDocument({
      data: {
        countFloat: 3.1415926,
        countInt1: 3,
      },
    })

    expect(transformedDocument).toMatchInlineSnapshot(`
      mutation {
        updateOneUser(
          data: {
            countFloat: {
              set: 3.1415926
            }
            countInt1: {
              set: 3
            }
          }
        ) {
          id
          email
          name
          json
          countFloat
          countInt1
          countInt2
          countInt3
          countInt4
          countInt5
          countInt6
          lastLoginAt
          coinflips
        }
      }
    `)
  })

  test('atomic operations with object wrapping', () => {
    const transformedDocument = getTransformedDocument({
      data: {
        countFloat: {
          set: null,
        },
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
      mutation {
        updateOneUser(
          data: {
            countFloat: {
              set: null
            }
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
          countFloat
          countInt1
          countInt2
          countInt3
          countInt4
          countInt5
          countInt6
          lastLoginAt
          coinflips
        }
      }
    `)
  })
})
