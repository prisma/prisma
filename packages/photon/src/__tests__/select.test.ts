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
})
