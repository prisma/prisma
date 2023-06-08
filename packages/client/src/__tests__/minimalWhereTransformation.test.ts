import { getDMMF } from '@prisma/internals'

import { blog } from '../fixtures/blog'
import { DMMFClass, makeDocument, transformDocument } from '../runtime'
import { MergedExtensionsList } from '../runtime/core/extensions/MergedExtensionsList'

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
      query {
        findManyUser(where: {
          OR: [
            {
              posts: {
                some: {
                  id: {
                    in: ["test"]
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
      query {
        findManyUser(where: {
          OR: [
            {
              name: {
                startsWith: "x"
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
      query {
        findManyUser(where: {
          OR: [
            {
              name: {
                endsWith: "x"
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

  test('implicit many-to-many relation: contains', () => {
    const transformedDocument = getTransformedDocument({
      where: {
        posts: {
          some: {
            title: {
              contains: 'mytitle',
            },
          },
        },
      },
    })

    expect(transformedDocument).toMatchInlineSnapshot(`
      query {
        findManyUser(where: {
          posts: {
            some: {
              title: {
                contains: "mytitle"
              }
            }
          }
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

  test('implicit many-to-many relation: select date equals (implicit)', () => {
    const transformedDocument = getTransformedDocument({
      select: {
        posts: {
          where: {
            OR: [
              {
                createdAt: '2020-08-19T10:02:43.353Z',
              },
            ],
          },
        },
      },
    })

    expect(transformedDocument).toMatchInlineSnapshot(`
      query {
        findManyUser {
          posts(where: {
            OR: [
              {
                createdAt: "2020-08-19T10:02:43.353Z"
              }
            ]
          }) {
            id
            createdAt
            updatedAt
            published
            title
            content
            authorId
            optional
          }
        }
      }
    `)
  })

  test('implicit many-to-many relation: select date equals (explicit)', () => {
    const transformedDocument = getTransformedDocument({
      select: {
        posts: {
          where: {
            OR: [
              {
                createdAt: { equals: '2020-08-19T10:02:43.353Z' },
              },
            ],
          },
        },
      },
    })

    expect(transformedDocument).toMatchInlineSnapshot(`
      query {
        findManyUser {
          posts(where: {
            OR: [
              {
                createdAt: {
                  equals: "2020-08-19T10:02:43.353Z"
                }
              }
            ]
          }) {
            id
            createdAt
            updatedAt
            published
            title
            content
            authorId
            optional
          }
        }
      }
    `)
  })

  test('implicit many-to-many relation: where null', () => {
    const transformedDocument = getTransformedDocument({
      select: {
        posts: {
          where: {
            content: null,
          },
        },
      },
    })

    expect(transformedDocument).toMatchInlineSnapshot(`
      query {
        findManyUser {
          posts(where: {
            content: null
          }) {
            id
            createdAt
            updatedAt
            published
            title
            content
            authorId
            optional
          }
        }
      }
    `)
  })

  test('where null', () => {
    const transformedDocument = getTransformedDocument({
      where: {
        name: null,
      },
    })

    expect(transformedDocument).toMatchInlineSnapshot(`
      query {
        findManyUser(where: {
          name: null
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

  test('one-to-one relation where null', () => {
    const transformedDocument = getTransformedDocument({
      where: {
        profile: {
          bio: { not: null },
        },
      },
    })

    expect(transformedDocument).toMatchInlineSnapshot(`
      query {
        findManyUser(where: {
          profile: {
            bio: {
              not: null
            }
          }
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
