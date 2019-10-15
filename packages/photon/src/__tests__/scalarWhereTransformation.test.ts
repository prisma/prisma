import chalk from 'chalk'
import { enums } from '../fixtures/enums'
import { DMMFClass, makeDocument, transformDocument } from '../runtime'
import { getDMMF } from '../utils/getDMMF'
chalk.enabled = false

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
    })
    expect(String(document)).toMatchInlineSnapshot(`
                                    "query {
                                      findManyUser(where: {
                                        AND: [
                                          {
                                            email: {
                                              equals: \\"a@a.de\\"
                                              gt: \\"0\\"
                                            }
                                            AND: [
                                              {
                                                name: {
                                                  equals: \\"5\\"
                                                  not: \\"7\\"
                                                }
                                                OR: [
                                                  {
                                                    id: {
                                                      not: \\"8\\"
                                                      notIn: [\\"7\\"]
                                                    }
                                                  },
                                                  {
                                                    id: {
                                                      not: \\"9\\"
                                                    }
                                                  }
                                                ]
                                              }
                                            ]
                                          },
                                          {
                                            id: {
                                              equals: \\"1\\"
                                              gt: \\"0\\"
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
                                      }
                                    }"
                        `)
    expect(String(transformDocument(document))).toMatchInlineSnapshot(`
                                    "query {
                                      findManyUser(where: {
                                        AND: [
                                          {
                                            email: \\"a@a.de\\"
                                            email_gt: \\"0\\"
                                            AND: [
                                              {
                                                name: \\"5\\"
                                                name_not: \\"7\\"
                                                OR: [
                                                  {
                                                    id_not: \\"8\\"
                                                    id_not_in: [\\"7\\"]
                                                  },
                                                  {
                                                    id_not: \\"9\\"
                                                  }
                                                ]
                                              }
                                            ]
                                          },
                                          {
                                            id: \\"1\\"
                                            id_gt: \\"0\\"
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
                                      }
                                    }"
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
    })

    expect(String(transformDocument(document))).toMatchInlineSnapshot(`
                                          "mutation {
                                            updateManyPost(
                                              where: {
                                                AND: [
                                                  {
                                                    title: {
                                                      \\"equals\\": \\"a@a.de\\",
                                                      \\"gt\\": \\"0\\"
                                                    }
                                                    AND: [
                                                      {
                                                        title: {
                                                          \\"equals\\": \\"5\\",
                                                          \\"not\\": \\"7\\"
                                                        }
                                                        OR: [
                                                          {
                                                            id_not: \\"8\\"
                                                          },
                                                          {
                                                            id_not: \\"9\\"
                                                          }
                                                        ]
                                                      }
                                                    ]
                                                  },
                                                  {
                                                    id: \\"1\\"
                                                    id_gt: \\"0\\"
                                                  }
                                                ]
                                              }
                                              data: {

                                              }
                                            ) {
                                              count
                                            }
                                          }"
                            `)
  })

  test('validate uuid scalar filter correctly', () => {
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
      }),
    )

    expect(String(document)).toMatchInlineSnapshot(`
                  "query {
                    findManyTest(where: {
                      id: \\"asd\\"
                    }) {
                      id
                      name
                    }
                  }"
            `)

    expect(() => document.validate(select, false, 'tests')).toThrowErrorMatchingInlineSnapshot(`
"
Invalid \`photon.tests()\` invocation:

{
  where: {
    id: 'asd'
        ~~~~~
  }
}

Argument id: Got invalid value 'asd' on photon.findManyTest. Provided String, expected UUID or UUIDFilter.
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
  })
})
