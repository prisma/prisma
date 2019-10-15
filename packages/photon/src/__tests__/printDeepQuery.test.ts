import chalk from 'chalk'
import { chinook } from '../fixtures/chinook'
import { DMMFClass, makeDocument, transformDocument } from '../runtime'
import { getDMMF } from '../utils/getDMMF'
chalk.enabled = false

describe('relation where transformation', () => {
  let dmmf
  beforeAll(async () => {
    dmmf = new DMMFClass(await getDMMF({ datamodel: chinook }))
  })

  test('transform correctly', () => {
    const select = {
      where: {
        Albums: {
          some: {
            Tracks: {
              some: {
                AND: {
                  UnitPrice: 5,
                  Playlists: {
                    some: {
                      Tracks: {
                        some: {
                          Name: '',
                          Genre: {
                            id: 5,
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
    }
    const document = makeDocument({
      dmmf,
      select,
      rootTypeName: 'query',
      rootField: 'findManyArtist',
    })
    const str = String(document)
    console.log(str)
    expect(str).toMatchInlineSnapshot(`
      "query {
        findManyArtist(where: {
          Albums: {
            some: {
              Tracks: {
                some: {
                  AND: [
                    {
                      UnitPrice: 5
                      Playlists: {
                        some: {
                          Tracks: {
                            \\"some\\": {
                              \\"Name\\": \\"\\",
                              \\"Genre\\": {
                                \\"id\\": 5
                              }
                            }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }) {
          id
          Name
        }
      }"
    `)
  })
})
