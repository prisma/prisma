import stripAnsi from 'strip-ansi'
import { blog } from '../fixtures/blog'
import { DMMFClass } from '../runtime/dmmf'
import { makeDocument } from '../runtime/query'
import { getDMMF } from '../generation/getDMMF'

let dmmf
beforeAll(async () => {
  const dmmfDocument = await getDMMF({ datamodel: blog })
  dmmf = new DMMFClass(dmmfDocument)
})

describe('include validation', () => {
  test('deep include query', () => {
    const ast = {
      include: {
        author: {
          include: {
            posts: true,
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

  test('dont allow empty include statements', () => {
    const ast = {
      include: {},
    }

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'query',
      rootField: 'findManyPost',
    })

    expect(String(document)).toMatchSnapshot()
    try {
      document.validate(ast, false)
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
        "
        Invalid \`prisma.findManyPost()\` invocation:

        {
          include: {
        ?   author?: true
          }
        }


        The \`include\` statement for type Post must not be empty. Available options are listed in green.
        "
      `)
    }
  })

  // Why do we allow it with include but not with select?
  // Very simple, because with select a statement with only false properties is useless
  // Why do we throw for an empty object? Also very simple: We want to help people to explore
  // the API through errors!
  test('allow include statement with only false properties', () => {
    const ast = {
      include: {
        author: true,
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

  test('allow deep include with empty object', () => {
    const ast = {
      include: {
        posts: {},
      },
    }

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'query',
      rootField: 'findManyUser',
    })

    expect(String(document)).toMatchInlineSnapshot(`
"query {
  findManyUser {
    id
    email
    name
    posts {
      id
      createdAt
      updatedAt
      published
      title
      content
    }
  }
}"
`)
    expect(() => document.validate(ast)).not.toThrow()
  })

  test('allow deep include without another include', () => {
    const ast = {
      include: {
        posts: { first: 20 },
      },
    }

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'query',
      rootField: 'findManyUser',
    })

    expect(String(document)).toMatchSnapshot()
    expect(() => document.validate(ast)).not.toThrow()
  })

  test('handle scalar fields special', () => {
    const ast = {
      include: {
        id: true,
      },
    }

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'query',
      rootField: 'findManyPost',
    })

    expect(String(document)).toMatchSnapshot()
    try {
      document.validate(ast, false)
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
        "
        Invalid \`prisma.id()\` invocation:

        {
          include: {
            id: true,
            ~~
        ?   author?: true
          }
        }


        Invalid scalar field \`id\` for include statement on model Post. Available options are listed in green.
        Note, that include statements only accept relation fields.
        "
      `)
    }
  })

  test('catch unknown field name', () => {
    const ast = {
      include: {
        mauthor: true,
      },
    }

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'query',
      rootField: 'findManyPost',
    })

    expect(String(document)).toMatchSnapshot()
    try {
      document.validate(ast, false)
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
        "
        Invalid \`prisma.mauthor()\` invocation:

        {
          include: {
            mauthor: true,
            ~~~~~~~
        ?   author?: true
          }
        }


        Unknown field \`mauthor\` for include statement on model Post. Available options are listed in green. Did you mean \`author\`?
        "
      `)
    }
  })

  test('allow include with a select', () => {
    const ast = {
      include: {
        posts: {
          first: 20,
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
      rootField: 'findManyUser',
    })

    expect(String(document)).toMatchInlineSnapshot(`
"query {
  findManyUser {
    id
    email
    name
    posts(first: 20) {
      id
    }
  }
}"
`)
    expect(() => document.validate(ast)).not.toThrow()
  })

  test('allow include with a select with an include', () => {
    const ast = {
      include: {
        posts: {
          first: 20,
          select: {
            id: true,
            author: {
              include: { posts: true },
            },
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

    expect(String(document)).toMatchInlineSnapshot(`
"query {
  findManyUser {
    id
    email
    name
    posts(first: 20) {
      id
      author {
        id
        email
        name
        posts {
          id
          createdAt
          updatedAt
          published
          title
          content
        }
      }
    }
  }
}"
`)
    expect(() => document.validate(ast)).not.toThrow()
  })
})
