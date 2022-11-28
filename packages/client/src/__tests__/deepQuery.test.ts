import chalk from 'chalk'

import { recommender } from '../fixtures/recommender'
import { getDMMF } from '../generation/getDMMF'
import { DMMFClass, makeDocument, transformDocument } from '../runtime'
import { MergedExtensionsList } from '../runtime/core/extensions/ExtensionsList'

chalk.level = 0

let dmmf
describe('minimal where transformation', () => {
  beforeAll(async () => {
    dmmf = new DMMFClass(await getDMMF({ datamodel: recommender }))
  })

  test('OR posts some id in', () => {
    const transformedDocument = getTransformedDocument({
      where: {
        likedArticles: {
          some: {
            likedBy: {
              some: {
                AND: {
                  likedArticles: {
                    some: {
                      likedBy: {
                        some: {
                          likedArticles: {
                            some: {
                              title: {
                                contains: 'A string',
                              },
                            },
                          },
                        },
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
      query {
        findManyUser(where: {
          likedArticles: {
            some: {
              likedBy: {
                some: {
                  AND: {
                    likedArticles: {
                      some: {
                        likedBy: {
                          some: {
                            likedArticles: {
                              some: {
                                title: {
                                  contains: "A string"
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }) {
          id
          name
          email
          personaId
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
