import chalk from 'chalk'
import { blog } from '../fixtures/blog'
import { DMMFClass, makeDocument, transformDocument } from '../runtime'
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

describe('minimal update transformation', () => {
  beforeAll(async () => {
    dmmf = new DMMFClass(await getDMMF({ datamodel: blog }))
  })

  test('set null values', () => {
    const transformedDocument = getTransformedDocument({
      data: {
        name: null,
        profile: {
          set: null,
        },
      },
    })

    expect(transformedDocument).toMatchInlineSnapshot(`
      "mutation {
        updateOneUser(
          data: {
            name: {
              set: null
            }
            profile: {
              set: null
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
        }
      }"
    `)
  })

  test('set date', () => {
    const transformedDocument = getTransformedDocument({
      data: {
        lastLoginAt: new Date('2020-09-04T07:45:24.484Z'),
      },
    })

    expect(transformedDocument).toMatchInlineSnapshot(`
      "mutation {
        updateOneUser(
          data: {
            lastLoginAt: {
              set: \\"2020-09-04T07:45:24.484Z\\"
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
        }
      }"
    `)
  })

  test('set date with set wrapper', () => {
    const transformedDocument = getTransformedDocument({
      data: {
        lastLoginAt: {
          set: new Date('2020-09-04T07:45:24.484Z'),
        },
      },
    })

    expect(transformedDocument).toMatchInlineSnapshot(`
      "mutation {
        updateOneUser(
          data: {
            lastLoginAt: {
              set: \\"2020-09-04T07:45:24.484Z\\"
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
        }
      }"
    `)
  })
})
