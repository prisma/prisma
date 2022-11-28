import chalk from 'chalk'

import { blog } from '../fixtures/blog'
import { getDMMF } from '../generation/getDMMF'
import { DMMFClass, makeDocument, transformDocument } from '../runtime'
import { MergedExtensionsList } from '../runtime/core/extensions/ExtensionsList'

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
      query {
        findManyUser(where: {
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
                                    id: "10"
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
            }
          ]
        }) {
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

function getTransformedDocument(select) {
  const document = makeDocument({
    dmmf,
    select,
    rootTypeName: 'query',
    rootField: 'findManyUser',
    extensions: MergedExtensionsList.empty(),
  })
  return String(transformDocument(document))
}
