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
        posts: {
          some: {
            author: {
              posts: {
                some: {
                  author: {
                    posts: {
                      some: {
                        id: '5',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    expect(transformedDocument).toMatchInlineSnapshot(`
      "query {
        findManyUser(where: {
          posts_some: {
            author: {
              posts_some: {
                author: {
                  posts_some: {
                    id: \\"5\\"
                  }
                }
              }
            }
          }
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
