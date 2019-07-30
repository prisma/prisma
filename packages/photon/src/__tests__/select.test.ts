import stripAnsi from 'strip-ansi'
import { blog } from '../fixtures/blog'
import { DMMFClass } from '../runtime/dmmf'
import { makeDocument } from '../runtime/query'
import { getDMMF } from '../utils/getDMMF'

let dmmf
beforeAll(async () => {
  const dmmfDocument = await getDMMF({ datamodel: blog })
  dmmf = new DMMFClass(dmmfDocument)
})

describe('select validation', () => {
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
      rootField: 'findManyUser',
    })
    expect(String(document)).toMatchSnapshot()
    try {
      document.validate(ast)
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
        "
        Invalid \`photon.findManyUser()\` invocation:

        {
          skip: 200,
          where: {
            name_contains: undefined,
            name_in: [
            ~~~~~~~
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
                ~~~~~~~~~~~~~
                name_gt: 2131203912039123,
                ~~~~~~~
                name_in: [
                ~~~~~~~
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
        ?   id?: true,
        ?   name?: true,
            name2: true,
            ~~~~~
        ?   posts?: true,
        ?   email?: true
          }
        }

        Unknown arg \`name_in\` in where.name_in for type UserWhereInput. Did you mean \`name\`? Available args:
        type UserWhereInput {
          id?: String | StringFilter
          email?: String | StringFilter
          name?: String | NullableStringFilter | null
          posts?: PostFilter
          AND?: UserWhereInput
          OR?: UserWhereInput
          NOT?: UserWhereInput
        }
        Unknown arg \`age_gt\` in where.AND.0.age_gt for type UserWhereInput. Did you mean \`name\`? Available args:
        type UserWhereInput {
          id?: String | StringFilter
          email?: String | StringFilter
          name?: String | NullableStringFilter | null
          posts?: PostFilter
          AND?: UserWhereInput
          OR?: UserWhereInput
          NOT?: UserWhereInput
        }
        Unknown arg \`this_is_completely_arbitrary\` in where.AND.0.this_is_completely_arbitrary for type UserWhereInput. Available args:

        type UserWhereInput {
          id?: String | StringFilter
          email?: String | StringFilter
          name?: String | NullableStringFilter | null
          posts?: PostFilter
          AND?: UserWhereInput
          OR?: UserWhereInput
          NOT?: UserWhereInput
        }
        Unknown arg \`age_gt\` in where.AND.1.age_gt for type UserWhereInput. Did you mean \`name\`? Available args:
        type UserWhereInput {
          id?: String | StringFilter
          email?: String | StringFilter
          name?: String | NullableStringFilter | null
          posts?: PostFilter
          AND?: UserWhereInput
          OR?: UserWhereInput
          NOT?: UserWhereInput
        }
        Unknown arg \`id_endsWith\` in where.AND.1.id_endsWith for type UserWhereInput. Available args:

        type UserWhereInput {
          id?: String | StringFilter
          email?: String | StringFilter
          name?: String | NullableStringFilter | null
          posts?: PostFilter
          AND?: UserWhereInput
          OR?: UserWhereInput
          NOT?: UserWhereInput
        }
        Unknown arg \`name_contains\` in where.AND.1.name_contains for type UserWhereInput. Available args:

        type UserWhereInput {
          id?: String | StringFilter
          email?: String | StringFilter
          name?: String | NullableStringFilter | null
          posts?: PostFilter
          AND?: UserWhereInput
          OR?: UserWhereInput
          NOT?: UserWhereInput
        }
        Unknown arg \`name_gt\` in where.AND.1.name_gt for type UserWhereInput. Did you mean \`name\`? Available args:
        type UserWhereInput {
          id?: String | StringFilter
          email?: String | StringFilter
          name?: String | NullableStringFilter | null
          posts?: PostFilter
          AND?: UserWhereInput
          OR?: UserWhereInput
          NOT?: UserWhereInput
        }
        Unknown arg \`name_in\` in where.AND.1.name_in for type UserWhereInput. Did you mean \`name\`? Available args:
        type UserWhereInput {
          id?: String | StringFilter
          email?: String | StringFilter
          name?: String | NullableStringFilter | null
          posts?: PostFilter
          AND?: UserWhereInput
          OR?: UserWhereInput
          NOT?: UserWhereInput
        }
        Unknown arg \`age_gt\` in where.AND.1.AND.0.age_gt for type UserWhereInput. Did you mean \`name\`? Available args:
        type UserWhereInput {
          id?: String | StringFilter
          email?: String | StringFilter
          name?: String | NullableStringFilter | null
          posts?: PostFilter
          AND?: UserWhereInput
          OR?: UserWhereInput
          NOT?: UserWhereInput
        }
        Unknown arg \`id_endsWith\` in where.AND.1.AND.0.id_endsWith for type UserWhereInput. Available args:

        type UserWhereInput {
          id?: String | StringFilter
          email?: String | StringFilter
          name?: String | NullableStringFilter | null
          posts?: PostFilter
          AND?: UserWhereInput
          OR?: UserWhereInput
          NOT?: UserWhereInput
        }
        Invalid value 'asd' of type String for field name on model User. Expected either true or false.
        Unknown field \`name2\` for select statement on model User. Available options are listed in green. Did you mean \`name\`?
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
      rootField: 'createOnePost',
    })

    expect(String(document)).toMatchSnapshot()
    try {
      document.validate(ast)
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
                                "
                                Invalid \`photon.createOnePost()\` invocation:

                                {
                                + data: {
                                +   id?: ID,
                                +   published: Boolean,
                                +   title: String,
                                +   content?: String,
                                +   author?: UserCreateOneWithoutAuthorInput
                                + }
                                }

                                Argument data for data is missing.

                                Note: Lines with + are required
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
      rootField: 'createOnePost',
    })

    expect(String(document)).toMatchSnapshot()
    try {
      document.validate(ast)
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
                                "
                                Invalid \`photon.createOnePost()\` invocation:

                                {
                                + data: {
                                +   id?: ID,
                                +   published: Boolean,
                                +   title: String,
                                +   content?: String,
                                +   author?: UserCreateOneWithoutAuthorInput
                                + }
                                }

                                Argument data for data is missing.

                                Note: Lines with + are required
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
      rootField: 'createOnePost',
    })

    expect(String(document)).toMatchSnapshot()
    try {
      document.validate(ast)
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
                                "
                                Invalid \`photon.createOnePost()\` invocation:

                                {
                                  data: {
                                    title: 'string',
                                    author: {
                                      connect: {
                                        id: ''
                                      }
                                    },
                                +   published: Boolean,
                                ?   id?: ID,
                                ?   content?: String
                                  }
                                }

                                Argument published for data.published is missing.

                                Note: Lines with + are required, lines with ? are optional.
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
      rootField: 'createOnePost',
    })

    expect(String(document)).toMatchSnapshot()
    try {
      document.validate(ast)
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
                                "
                                Invalid \`photon.createOnePost()\` invocation:

                                {
                                  data: {
                                    title: 'string',
                                +   published: Boolean,
                                ?   id?: ID,
                                ?   content?: String,
                                ?   author?: {
                                ?     create?: UserCreateWithoutPostsInput,
                                ?     connect?: UserWhereUniqueInput
                                ?   }
                                  }
                                }

                                Argument published for data.published is missing.

                                Note: Lines with + are required, lines with ? are optional.
                                "
                        `)
    }
  })

  test('Allow simple create mutation', () => {
    const ast = {
      data: {
        title: 'Some title',
        content: 'Some Content',
        published: false,
      },
    }

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'mutation',
      rootField: 'createOnePost',
    })

    expect(String(document)).toMatchSnapshot()
    expect(() => document.validate(ast)).not.toThrow()
  })

  test('Allow explicit null value', () => {
    const ast = {
      data: {
        title: 'Some title',
        content: null,
        published: false,
      },
    }

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'mutation',
      rootField: 'createOnePost',
    })

    expect(String(document)).toMatchSnapshot()
    expect(() => document.validate(ast)).not.toThrow()
  })

  test('Allow uuid for string input', () => {
    const ast = {
      data: {
        title: 'Some title',
        content: '123e4567-e89b-12d3-a456-426655440000',
        published: false,
      },
    }

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'mutation',
      rootField: 'createOnePost',
    })

    expect(String(document)).toMatchSnapshot()
    expect(() => document.validate(ast)).not.toThrow()
  })

  test('Allow deep select query', () => {
    const ast = {
      select: {
        author: {
          select: {
            id: true,
          },
        },
      },
    }

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'query',
      rootField: 'findManyPost',
    })

    expect(String(document)).toMatchSnapshot()
    expect(() => document.validate(ast)).not.toThrow()
  })

  test('Accept empty where in findMany', () => {
    const ast = {
      select: {
        author: {
          select: {
            id: true,
          },
        },
      },
      where: {},
    }

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'query',
      rootField: 'findManyPost',
    })

    expect(String(document)).toMatchSnapshot()
    expect(() => document.validate(ast)).not.toThrow()
  })

  test('allow where with all undefined in findMany', () => {
    const ast = {
      select: {
        author: {
          select: {
            id: true,
          },
        },
      },
      where: {
        id: undefined,
      },
    }

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'query',
      rootField: 'findManyPost',
    })

    expect(String(document)).toMatchSnapshot()
    expect(() => document.validate(ast)).not.toThrow()
  })

  test('reject empty where for findOne', () => {
    const ast = {
      select: {
        author: {
          select: {
            id: true,
          },
        },
      },
      where: {},
    }

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'query',
      rootField: 'findOnePost',
    })

    expect(String(document)).toMatchSnapshot()
    try {
      document.validate(ast)
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
                "
                Invalid \`photon.findOnePost()\` invocation:

                {
                  select: {
                    author: {
                      select: {
                        id: true
                      }
                    }
                  },
                  where: {
                ?   id?: ID
                  }
                }

                Argument where of type PostWhereUniqueInput needs at least one argument. Available args are listed in green.

                Note: Lines with ? are optional.
                "
            `)
    }
  })

  test('reject all undefined where for findOne', () => {
    const ast = {
      select: {
        author: {
          select: {
            id: true,
          },
        },
      },
      where: {
        id: undefined,
      },
    }

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'query',
      rootField: 'findOnePost',
    })

    expect(String(document)).toMatchSnapshot()
    try {
      document.validate(ast)
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
                "
                Invalid \`photon.findOnePost()\` invocation:

                {
                  select: {
                    author: {
                      select: {
                        id: true
                      }
                    }
                  },
                  where: {
                ?   id?: ID
                  }
                }

                Argument where of type PostWhereUniqueInput needs at least one argument. Available args are listed in green.

                Note: Lines with ? are optional.
                "
            `)
    }
  })

  test('Allow uuid array for string array', () => {
    const ast = {
      select: {
        author: {
          select: {
            id: true,
          },
        },
      },
      where: {
        id: {
          in: ['d4082b42-b161-11e9-8754-6542abf52968'],
        },
      },
    }

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'query',
      rootField: 'findManyPost',
    })

    expect(String(document)).toMatchSnapshot()
    expect(() => document.validate(ast)).not.toThrow()
  })
})
