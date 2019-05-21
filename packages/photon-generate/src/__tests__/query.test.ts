import { makeDocument } from '../runtime/query'
import { DMMFClass } from '../runtime/dmmf'
import { dmmfDocument } from '../fixtures/example-dmmf'
import stripAnsi from 'strip-ansi'

describe('validation', () => {
  const dmmf = new DMMFClass(dmmfDocument)
  test('unknown arg, field, incorrect arg type', () => {
    const ast = {
      skip: 200,
      where: {
        name_contains: undefined,
        name_in: ['hans', 'peter', 'schmidt'],
        AND: [
          {
            age_gt: 10123123123,
            this_is_completely_arbitrary: 'veryLongNameGoIntoaNewLineNow@gmail.com',
          },
          {
            age_gt: 10123123123,
            id_endsWith: 'veryLongNameGoIntoaNewLineNow@gmail.com',
            name_contains: 'hans',
            name_gt: 2131203912039123,
            name_in: ['hans'],
            AND: [
              {
                age_gt: '10123123123',
                id_endsWith: 'veryLongNameGoIntoaNewLineNow@gmail.com',
              },
            ],
          },
        ],
      },
      select: {
        id: true,
        name: 'asd',
        name2: true,
        posts: {
          first: 200,
          select: {
            id: true,
            title: false,
          },
        },
      },
    }

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'query',
      rootField: 'users',
    })
    expect(String(document)).toMatchSnapshot()
    try {
      document.validate(ast, true)
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
                "

                Invalid \`photon.query()\` invocation:

                {
                  users: {
                    skip: 200,
                    where: {
                      name_contains: undefined,
                      name_in: [
                        'hans',
                        'peter',
                        'schmidt'
                      ],
                      AND: [
                        {
                          age_gt: 10123123123,
                          ~~~~~~
                          this_is_completely_arbitrary: 'veryLongNameGoIntoaNewLineNow@gmail.com'
                          ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                        },
                        {
                          age_gt: 10123123123,
                          ~~~~~~
                          id_endsWith: 'veryLongNameGoIntoaNewLineNow@gmail.com',
                          ~~~~~~~~~~~
                          name_contains: 'hans',
                          name_gt: 2131203912039123,
                                   ~~~~~~~~~~~~~~~~
                          name_in: [
                            'hans'
                          ],
                          AND: [
                            {
                              age_gt: '10123123123',
                              ~~~~~~
                              id_endsWith: 'veryLongNameGoIntoaNewLineNow@gmail.com'
                              ~~~~~~~~~~~
                            }
                          ]
                        }
                      ]
                    },
                    select: {
                      id: true,
                      name: 'asd',
                            ~~~~~
                      name2: true,
                      ~~~~~
                      posts: {
                        first: 200,
                        select: {
                          id: true,
                          title: false
                        }
                      }
                    }
                  }
                }

                Unknown arg \`age_gt\` in users.where.AND.0.age_gt. for type UserWhereInput. Did you mean \`name_gt\`? Available args:
                type UserWhereInput {
                  id?: ID
                  id_not?: ID
                  id_in?: List<ID>
                  id_not_in?: List<ID>
                  id_lt?: ID
                  id_lte?: ID
                  id_gt?: ID
                  id_gte?: ID
                  id_contains?: ID
                  id_not_contains?: ID
                  id_starts_with?: ID
                  id_not_starts_with?: ID
                  id_ends_with?: ID
                  id_not_ends_with?: ID
                  name?: String
                  name_not?: String
                  name_in?: List<String>
                  name_not_in?: List<String>
                  name_lt?: String
                  name_lte?: String
                  name_gt?: String
                  name_gte?: String
                  name_contains?: String
                  name_not_contains?: String
                  name_starts_with?: String
                  name_not_starts_with?: String
                  name_ends_with?: String
                  name_not_ends_with?: String
                  posts_every?: PostWhereInput
                  posts_some?: PostWhereInput
                  posts_none?: PostWhereInput
                  AND?: UserWhereInput
                  OR?: UserWhereInput
                  NOT?: UserWhereInput
                }
                Unknown arg \`this_is_completely_arbitrary\` in users.where.AND.0.this_is_completely_arbitrary. for type UserWhereInput. Available args:
                type UserWhereInput {
                  id?: ID
                  id_not?: ID
                  id_in?: List<ID>
                  id_not_in?: List<ID>
                  id_lt?: ID
                  id_lte?: ID
                  id_gt?: ID
                  id_gte?: ID
                  id_contains?: ID
                  id_not_contains?: ID
                  id_starts_with?: ID
                  id_not_starts_with?: ID
                  id_ends_with?: ID
                  id_not_ends_with?: ID
                  name?: String
                  name_not?: String
                  name_in?: List<String>
                  name_not_in?: List<String>
                  name_lt?: String
                  name_lte?: String
                  name_gt?: String
                  name_gte?: String
                  name_contains?: String
                  name_not_contains?: String
                  name_starts_with?: String
                  name_not_starts_with?: String
                  name_ends_with?: String
                  name_not_ends_with?: String
                  posts_every?: PostWhereInput
                  posts_some?: PostWhereInput
                  posts_none?: PostWhereInput
                  AND?: UserWhereInput
                  OR?: UserWhereInput
                  NOT?: UserWhereInput
                }
                Unknown arg \`age_gt\` in users.where.AND.1.age_gt. for type UserWhereInput. Did you mean \`name_gt\`? Available args:
                type UserWhereInput {
                  id?: ID
                  id_not?: ID
                  id_in?: List<ID>
                  id_not_in?: List<ID>
                  id_lt?: ID
                  id_lte?: ID
                  id_gt?: ID
                  id_gte?: ID
                  id_contains?: ID
                  id_not_contains?: ID
                  id_starts_with?: ID
                  id_not_starts_with?: ID
                  id_ends_with?: ID
                  id_not_ends_with?: ID
                  name?: String
                  name_not?: String
                  name_in?: List<String>
                  name_not_in?: List<String>
                  name_lt?: String
                  name_lte?: String
                  name_gt?: String
                  name_gte?: String
                  name_contains?: String
                  name_not_contains?: String
                  name_starts_with?: String
                  name_not_starts_with?: String
                  name_ends_with?: String
                  name_not_ends_with?: String
                  posts_every?: PostWhereInput
                  posts_some?: PostWhereInput
                  posts_none?: PostWhereInput
                  AND?: UserWhereInput
                  OR?: UserWhereInput
                  NOT?: UserWhereInput
                }
                Unknown arg \`id_endsWith\` in users.where.AND.1.id_endsWith. for type UserWhereInput. Did you mean \`id_ends_with\`? Available args:
                type UserWhereInput {
                  id?: ID
                  id_not?: ID
                  id_in?: List<ID>
                  id_not_in?: List<ID>
                  id_lt?: ID
                  id_lte?: ID
                  id_gt?: ID
                  id_gte?: ID
                  id_contains?: ID
                  id_not_contains?: ID
                  id_starts_with?: ID
                  id_not_starts_with?: ID
                  id_ends_with?: ID
                  id_not_ends_with?: ID
                  name?: String
                  name_not?: String
                  name_in?: List<String>
                  name_not_in?: List<String>
                  name_lt?: String
                  name_lte?: String
                  name_gt?: String
                  name_gte?: String
                  name_contains?: String
                  name_not_contains?: String
                  name_starts_with?: String
                  name_not_starts_with?: String
                  name_ends_with?: String
                  name_not_ends_with?: String
                  posts_every?: PostWhereInput
                  posts_some?: PostWhereInput
                  posts_none?: PostWhereInput
                  AND?: UserWhereInput
                  OR?: UserWhereInput
                  NOT?: UserWhereInput
                }
                Argument name_gt: Got invalid value 2131203912039123 on photon.users. Provided Int, expected String.
                Unknown arg \`age_gt\` in users.where.AND.1.AND.0.age_gt. for type UserWhereInput. Did you mean \`name_gt\`? Available args:
                type UserWhereInput {
                  id?: ID
                  id_not?: ID
                  id_in?: List<ID>
                  id_not_in?: List<ID>
                  id_lt?: ID
                  id_lte?: ID
                  id_gt?: ID
                  id_gte?: ID
                  id_contains?: ID
                  id_not_contains?: ID
                  id_starts_with?: ID
                  id_not_starts_with?: ID
                  id_ends_with?: ID
                  id_not_ends_with?: ID
                  name?: String
                  name_not?: String
                  name_in?: List<String>
                  name_not_in?: List<String>
                  name_lt?: String
                  name_lte?: String
                  name_gt?: String
                  name_gte?: String
                  name_contains?: String
                  name_not_contains?: String
                  name_starts_with?: String
                  name_not_starts_with?: String
                  name_ends_with?: String
                  name_not_ends_with?: String
                  posts_every?: PostWhereInput
                  posts_some?: PostWhereInput
                  posts_none?: PostWhereInput
                  AND?: UserWhereInput
                  OR?: UserWhereInput
                  NOT?: UserWhereInput
                }
                Unknown arg \`id_endsWith\` in users.where.AND.1.AND.0.id_endsWith. for type UserWhereInput. Did you mean \`id_ends_with\`? Available args:
                type UserWhereInput {
                  id?: ID
                  id_not?: ID
                  id_in?: List<ID>
                  id_not_in?: List<ID>
                  id_lt?: ID
                  id_lte?: ID
                  id_gt?: ID
                  id_gte?: ID
                  id_contains?: ID
                  id_not_contains?: ID
                  id_starts_with?: ID
                  id_not_starts_with?: ID
                  id_ends_with?: ID
                  id_not_ends_with?: ID
                  name?: String
                  name_not?: String
                  name_in?: List<String>
                  name_not_in?: List<String>
                  name_lt?: String
                  name_lte?: String
                  name_gt?: String
                  name_gte?: String
                  name_contains?: String
                  name_not_contains?: String
                  name_starts_with?: String
                  name_not_starts_with?: String
                  name_ends_with?: String
                  name_not_ends_with?: String
                  posts_every?: PostWhereInput
                  posts_some?: PostWhereInput
                  posts_none?: PostWhereInput
                  AND?: UserWhereInput
                  OR?: UserWhereInput
                  NOT?: UserWhereInput
                }
                Invalid value 'asd' of type String for field name on model User. Expected either true or false.
                Unknown field \`name2\` on model User. Did you mean \`name\`?
                "
            `)
    }
  })
  test('missing arg object', () => {
    const ast = {}

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'mutation',
      rootField: 'createPost',
    })

    expect(String(document)).toMatchSnapshot()
    try {
      document.validate(ast)
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
        "

        Invalid \`photon.createPost()\` invocation:

        {
        + data: {
        +   id?: ID,
        +   title: String,
        +   content: String,
        +   author: {
        +     create?: {
        +       id?: ID,
        +       name: String,
        +       strings?: UserCreatestringsInput
        +     },
        +     connect?: {
        +       id?: ID
        +     }
        +   }
        + }
        }

        Argument data for photon.data is missing. You can see in green what you need to add.

        "
      `)
    }
  })

  test('missing arg object', () => {
    const ast = {}

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'mutation',
      rootField: 'createPost',
    })

    expect(String(document)).toMatchSnapshot()
    try {
      document.validate(ast)
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
        "

        Invalid \`photon.createPost()\` invocation:

        {
        + data: {
        +   id?: ID,
        +   title: String,
        +   content: String,
        +   author: {
        +     create?: {
        +       id?: ID,
        +       name: String,
        +       strings?: UserCreatestringsInput
        +     },
        +     connect?: {
        +       id?: ID
        +     }
        +   }
        + }
        }

        Argument data for photon.data is missing. You can see in green what you need to add.

        "
      `)
    }
  })

  test('missing arg scalar', () => {
    const ast = {
      data: {
        title: 'string',
        author: {
          connect: { id: '' },
        },
      },
    }

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'mutation',
      rootField: 'createPost',
    })

    expect(String(document)).toMatchSnapshot()
    try {
      document.validate(ast)
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
                        "

                        Invalid \`photon.createPost()\` invocation:

                        {
                          data: {
                            title: 'string',
                            author: {
                              connect: {
                                id: ''
                              }
                            },
                        +   content: String,
                        +   id?: ID
                          }
                        }

                        Argument content for photon.data.content is missing. You can see in green what you need to add.

                        "
                  `)
    }
  })

  test('missing arg scalar && object', () => {
    const ast = {
      data: {
        title: 'string',
      },
    }

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'mutation',
      rootField: 'createPost',
    })

    expect(String(document)).toMatchSnapshot()
    try {
      document.validate(ast)
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
        "

        Invalid \`photon.createPost()\` invocation:

        {
          data: {
            title: 'string',
        +   content: String,
        +   author: {
        +     create?: {
        +       id?: ID,
        +       name: String,
        +       strings?: UserCreatestringsInput
        +     },
        +     connect?: {
        +       id?: ID
        +     }
        +   },
        +   id?: ID
          }
        }

        Argument content for photon.data.content is missing. You can see in green what you need to add.
        Argument author for photon.data.author is missing. You can see in green what you need to add.

        "
      `)
    }
  })
})
