import stripAnsi from 'strip-ansi'
import { dmmfDocument } from '../fixtures/example-dmmf'
import { DMMFClass } from '../runtime/dmmf'
import { makeDocument } from '../runtime/query'

describe.skip('validation', () => {
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
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`"Cannot read property 'select' of undefined"`)
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
        +       strings?: {
        +         set?: String
        +       }
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
        +       strings?: {
        +         set?: String
        +       }
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
        +       strings?: {
        +         set?: String
        +       }
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
