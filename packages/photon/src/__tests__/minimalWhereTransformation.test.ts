import chalk from 'chalk'
import { blog } from '../fixtures/blog'
import { DMMFClass, makeDocument, transformDocument } from '../runtime'
import { getDMMF } from '../runtime/getDMMF'
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
              posts_some: {
                id_in: [\\"test\\"]
              }
            }
          ]
        }) {
          id
          email
          name
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
              name_starts_with: \\"x\\"
            }
          ]
        }) {
          id
          email
          name
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
              name_ends_with: \\"x\\"
            }
          ]
        }) {
          id
          email
          name
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
