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
    const transformedDocument = getTransformedDocument({
      where: {
        OR: [
          {
            posts: {
              some: {
                id: {
                  in: ['test'],
                },
              },
            },
          },
        ],
      },
    })

    expect(transformedDocument).toMatchInlineSnapshot(`
      "query {
        findManyUser(where: {
          OR: [
            {
              posts: {
                is: {
                  some: {
                    id: {
                      in: [\\"test\\"]
                    }
                  }
                }
              }
            }
          ]
        }) {
          id
          email
          name
          json
        }
      }"
    `)
  })

  test('OR name startsWith', () => {
    const transformedDocument = getTransformedDocument({
      where: {
        OR: [
          {
            name: {
              startsWith: 'x',
            },
          },
        ],
      },
    })

    expect(transformedDocument).toMatchInlineSnapshot(`
      "query {
        findManyUser(where: {
          OR: [
            {
              name: {
                startsWith: \\"x\\"
              }
            }
          ]
        }) {
          id
          email
          name
          json
        }
      }"
    `)
  })

  test('OR name endsWith', () => {
    const transformedDocument = getTransformedDocument({
      where: {
        OR: [
          {
            name: {
              endsWith: 'x',
            },
          },
        ],
      },
    })

    expect(transformedDocument).toMatchInlineSnapshot(`
      "query {
        findManyUser(where: {
          OR: [
            {
              name: {
                endsWith: \\"x\\"
              }
            }
          ]
        }) {
          id
          email
          name
          json
        }
      }"
    `)
  })
})

function getTransformedDocument(select) {
  const document = makeDocument({
    dmmf,
    select,
    rootTypeName: 'query',
    rootField: 'findManyUser',
  })
  return String(transformDocument(document))
}
