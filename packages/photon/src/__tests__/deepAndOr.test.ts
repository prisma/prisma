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
                OR: [
                  {
                    author: {
                      OR: [
                        {
                          AND: [
                            {
                              OR: [
                                {
                                  id: '10',
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  },
                ],
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
                OR: [
                  {
                    author: {
                      OR: [
                        {
                          AND: [
                            {
                              OR: [
                                {
                                  id: \\"10\\"
                                }
                              ]
                            }
                          ]
                        }
                      ]
                    }
                  }
                ]
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
