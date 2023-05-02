import { getDMMF } from '@prisma/internals'

import { blog } from '../fixtures/blog'
import { DMMFClass, makeDocument, transformDocument } from '../runtime'
import { MergedExtensionsList } from '../runtime/core/extensions/MergedExtensionsList'

let dmmf

function getTransformedDocument(select) {
  const document = makeDocument({
    dmmf,
    select,
    rootTypeName: 'mutation',
    rootField: 'updateOneUser',
    extensions: MergedExtensionsList.empty(),
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
        posts: {
          updateMany: {
            data: {
              optional: null,
              content: {
                set: null,
              },
            },
            where: {
              id: 'someid',
            },
          },
        },
      },
    })

    expect(transformedDocument).toMatchInlineSnapshot(`
      mutation {
        updateOneUser(
          data: {
            name: null
            profile: {
              set: null
            }
            posts: {
              updateMany: {
                data: {
                  optional: null
                  content: {
                    set: null
                  }
                }
                where: {
                  id: "someid"
                }
              }
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

  test('set date', () => {
    const transformedDocument = getTransformedDocument({
      data: {
        lastLoginAt: new Date('2020-09-04T07:45:24.484Z'),
        posts: {
          updateMany: {
            data: {
              updatedAt: new Date('2020-09-04T07:45:24.484Z'),
            },
            where: {
              id: 'someid',
            },
          },
        },
      },
    })

    expect(transformedDocument).toMatchInlineSnapshot(`
      mutation {
        updateOneUser(
          data: {
            lastLoginAt: "2020-09-04T07:45:24.484Z"
            posts: {
              updateMany: {
                data: {
                  updatedAt: "2020-09-04T07:45:24.484Z"
                }
                where: {
                  id: "someid"
                }
              }
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

  test('set date with set wrapper', () => {
    const transformedDocument = getTransformedDocument({
      data: {
        lastLoginAt: {
          set: new Date('2020-09-04T07:45:24.484Z'),
        },
        posts: {
          updateMany: {
            data: {
              updatedAt: {
                set: new Date('2020-09-04T07:45:24.484Z'),
              },
            },
            where: {
              id: 'someid',
            },
          },
        },
      },
    })

    expect(transformedDocument).toMatchInlineSnapshot(`
      mutation {
        updateOneUser(
          data: {
            lastLoginAt: {
              set: "2020-09-04T07:45:24.484Z"
            }
            posts: {
              updateMany: {
                data: {
                  updatedAt: {
                    set: "2020-09-04T07:45:24.484Z"
                  }
                }
                where: {
                  id: "someid"
                }
              }
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

  test('Boolean[] list with set', () => {
    const transformedDocument = getTransformedDocument({
      data: {
        coinflips: {
          set: [true, true, true, false, true],
        },
      },
    })

    expect(transformedDocument).toMatchInlineSnapshot(`
      mutation {
        updateOneUser(
          data: {
            coinflips: {
              set: [true, true, true, false, true]
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

  test('Boolean[] list without set', () => {
    const transformedDocument = getTransformedDocument({
      data: {
        coinflips: [true, true, true, false, true],
      },
    })

    // this is broken and needs to be fixed
    expect(transformedDocument).toMatchInlineSnapshot(`
      mutation {
        updateOneUser(
          data: {
            coinflips: [true, true, true, false, true]
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
