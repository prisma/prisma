import chalk from 'chalk'
import stripAnsi from 'strip-ansi'

import { enums } from '../fixtures/enums'
import { getDMMF } from '../generation/getDMMF'
import { DMMFClass, makeDocument, transformDocument } from '../runtime'
import { MergedExtensionsList } from '../runtime/core/extensions/MergedExtensionsList'

chalk.level = 0

describe('scalar where transformation', () => {
  let dmmf
  beforeAll(async () => {
    dmmf = new DMMFClass(await getDMMF({ datamodel: enums }))
  })

  test('transform correctly', () => {
    const select = {
      where: {
        AND: [
          {
            email: {
              equals: 'a@a.de',
              gt: '0',
            },
            AND: [
              {
                name: {
                  equals: '5',
                  not: '7',
                },
                OR: [
                  {
                    id: {
                      not: '8',
                      notIn: ['7'],
                    },
                  },
                  {
                    id: {
                      not: '9',
                    },
                  },
                ],
              },
            ],
          },
          {
            id: {
              equals: '1',
              gt: '0',
            },
          },
        ],
      },
    }
    const document = makeDocument({
      dmmf,
      select,
      rootTypeName: 'query',
      rootField: 'findManyUser',
      extensions: MergedExtensionsList.empty(),
    })
    expect(String(document)).toMatchInlineSnapshot(`
      query {
        findManyUser(where: {
          AND: [
            {
              email: {
                equals: "a@a.de"
                gt: "0"
              }
              AND: [
                {
                  name: {
                    equals: "5"
                    not: "7"
                  }
                  OR: [
                    {
                      id: {
                        not: "8"
                        notIn: ["7"]
                      }
                    },
                    {
                      id: {
                        not: "9"
                      }
                    }
                  ]
                }
              ]
            },
            {
              id: {
                equals: "1"
                gt: "0"
              }
            }
          ]
        }) {
          id
          name
          email
          status
          nicknames
          permissions
          favoriteTree
          locationId
          someFloats
        }
      }
    `)
    expect(String(transformDocument(document))).toMatchInlineSnapshot(`
      query {
        findManyUser(where: {
          AND: [
            {
              email: {
                equals: "a@a.de"
                gt: "0"
              }
              AND: [
                {
                  name: {
                    equals: "5"
                    not: "7"
                  }
                  OR: [
                    {
                      id: {
                        not: "8"
                        notIn: ["7"]
                      }
                    },
                    {
                      id: {
                        not: "9"
                      }
                    }
                  ]
                }
              ]
            },
            {
              id: {
                equals: "1"
                gt: "0"
              }
            }
          ]
        }) {
          id
          name
          email
          status
          nicknames
          permissions
          favoriteTree
          locationId
          someFloats
        }
      }
    `)
  })

  test('MODELScalarWhereInput', () => {
    const select = {
      where: {
        AND: [
          {
            title: {
              equals: 'a@a.de',
              gt: '0',
            },
            AND: [
              {
                title: {
                  equals: '5',
                  not: '7',
                },
                OR: [
                  {
                    id: {
                      not: '8',
                    },
                  },
                  {
                    id: {
                      not: '9',
                    },
                  },
                ],
              },
            ],
          },
          {
            id: {
              equals: '1',
              gt: '0',
            },
          },
        ],
      },
      data: {},
    }
    const document = makeDocument({
      dmmf,
      select,
      rootTypeName: 'mutation',
      rootField: 'updateManyPost',
      extensions: MergedExtensionsList.empty(),
    })

    expect(() => document.validate(select)).toThrowErrorMatchingInlineSnapshot(`

      Invalid \`prisma.updateManyPost()\` invocation:

      {
        where: {
          AND: [
            {
              title: {
              ~~~~~
                equals: 'a@a.de',
                gt: '0'
              },
              AND: [
                {
                  title: {
                  ~~~~~
                    equals: '5',
                    not: '7'
                  },
                  OR: [
                    {
                      id: {
                        not: '8'
                      }
                    },
                    {
                      id: {
                        not: '9'
                      }
                    }
                  ]
                }
              ]
            },
            {
              id: {
                equals: '1',
                gt: '0'
              }
            }
          ]
        },
        data: {}
      }

      Unknown arg \`title\` in where.AND.0.title for type PostWhereInput. Did you mean \`id\`? Available args:
      type PostWhereInput {
        AND?: PostWhereInput | List<PostWhereInput>
        OR?: List<PostWhereInput>
        NOT?: PostWhereInput | List<PostWhereInput>
        id?: StringFilter | String
        name?: StringFilter | String
        email?: StringFilter | String
        createdAt?: DateTimeFilter | DateTime
        updatedAt?: DateTimeFilter | DateTime
        userId?: StringFilter | String
        user?: UserRelationFilter | UserWhereInput
      }
      Unknown arg \`title\` in where.AND.0.AND.0.title for type PostWhereInput. Did you mean \`id\`? Available args:
      type PostWhereInput {
        AND?: PostWhereInput | List<PostWhereInput>
        OR?: List<PostWhereInput>
        NOT?: PostWhereInput | List<PostWhereInput>
        id?: StringFilter | String
        name?: StringFilter | String
        email?: StringFilter | String
        createdAt?: DateTimeFilter | DateTime
        updatedAt?: DateTimeFilter | DateTime
        userId?: StringFilter | String
        user?: UserRelationFilter | UserWhereInput
      }


    `)

    expect(String(transformDocument(document))).toMatchInlineSnapshot(`
      mutation {
        updateManyPost(
          where: {
            AND: [
              {
                title: {
                  "equals": "a@a.de",
                  "gt": "0"
                }
                AND: [
                  {
                    title: {
                      "equals": "5",
                      "not": "7"
                    }
                    OR: [
                      {
                        id: {
                          not: "8"
                        }
                      },
                      {
                        id: {
                          not: "9"
                        }
                      }
                    ]
                  }
                ]
              },
              {
                id: {
                  equals: "1"
                  gt: "0"
                }
              }
            ]
          }
          data: {

          }
        ) {
          count
        }
      }
    `)
  })

  test('validate uuid scalar filter correctly', () => {
    const select = {
      where: {
        id: '806c902c-eab3-4e6e-ba4a-99c135389118',
      },
    }
    const document = transformDocument(
      makeDocument({
        dmmf,
        select,
        rootTypeName: 'query',
        rootField: 'findManyTest',
        extensions: MergedExtensionsList.empty(),
      }),
    )

    expect(String(document)).toMatchInlineSnapshot(`
      query {
        findManyTest(where: {
          id: "806c902c-eab3-4e6e-ba4a-99c135389118"
        }) {
          id
          name
        }
      }
    `)

    expect(document.validate(select, false, 'tests')).toMatchInlineSnapshot(`undefined`)
  })

  test('validate uuid scalar filter should error when invalid input', () => {
    const select = {
      where: {
        id: 'asd',
      },
    }

    const document = transformDocument(
      makeDocument({
        dmmf,
        select,
        rootTypeName: 'query',
        rootField: 'findManyTest',
        extensions: MergedExtensionsList.empty(),
      }),
    )

    expect(String(document)).toMatchInlineSnapshot(`
      query {
        findManyTest(where: {
          id: "asd"
        }) {
          id
          name
        }
      }
    `)

    try {
      expect(document.validate(select, false, 'tests')).toMatchInlineSnapshot(`undefined`)
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
        "
        Invalid \`prisma.tests()\` invocation:

        {
          where: {
            id: 'asd'
                ~~~~~
          }
        }

        Argument id: Got invalid value 'asd' on prisma.findManyTest. Provided String, expected UUID or UUIDFilter.
        type UUIDFilter {
          equals?: UUID
          not?: UUID | UUIDFilter
          in?: List<UUID>
          notIn?: List<UUID>
          lt?: UUID
          lte?: UUID
          gt?: UUID
          gte?: UUID
          contains?: UUID
          startsWith?: UUID
          endsWith?: UUID
        }

        "
      `)
    }
  })

  test('filter by enum', () => {
    const select = {
      where: {
        favoriteTree: {
          in: ['OAK', 'BLACKASH'],
        },
      },
    }
    const document = makeDocument({
      dmmf,
      select,
      rootTypeName: 'query',
      rootField: 'findManyUser',
      extensions: MergedExtensionsList.empty(),
    })

    expect(String(transformDocument(document))).toMatchInlineSnapshot(`
      query {
        findManyUser(where: {
          favoriteTree: {
            in: [OAK, BLACKASH]
          }
        }) {
          id
          name
          email
          status
          nicknames
          permissions
          favoriteTree
          locationId
          someFloats
        }
      }
    `)

    document.validate(select, false, 'user')
  })
})
