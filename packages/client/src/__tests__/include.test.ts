import stripAnsi from 'strip-ansi'

import { blog } from '../fixtures/blog'
import { getDMMF } from '../generation/getDMMF'
import { MergedExtensionsList } from '../runtime/core/extensions/ExtensionsList'
import { DMMFHelper } from '../runtime/dmmf'
import { makeDocument } from '../runtime/query'

let dmmf
beforeAll(async () => {
  const dmmfDocument = await getDMMF({ datamodel: blog })
  dmmf = new DMMFHelper(dmmfDocument)
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
      extensions: MergedExtensionsList.empty(),
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
      extensions: MergedExtensionsList.empty(),
    })

    expect(String(document)).toMatchSnapshot()
    try {
      document.validate(ast, false)
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`

Invalid \`prisma.findManyPost()\` invocation:

{
  include: {
?   author?: true,
?   categories?: true,
?   _count?: true
  }
}


The \`include\` statement for type Post must not be empty. Available options are listed in green.

`)
    }
  })

  test('allow normal findMany without include for empty model', () => {
    const ast = {}

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'query',
      rootField: 'findManyNoRelations',
      extensions: MergedExtensionsList.empty(),
    })

    expect(String(document)).toMatchSnapshot()
    document.validate(ast, false)
  })

  test('enforce no include, if no relation', () => {
    const ast = {
      include: {},
    }

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'query',
      extensions: MergedExtensionsList.empty(),
      rootField: 'findManyNoRelations',
    })

    expect(String(document)).toMatchSnapshot()
    try {
      document.validate(ast, false)
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`

        Invalid \`prisma.findManyNoRelations()\` invocation:

        {
          include: {}
        }


        NoRelations does not have any relation and therefore can't have an \`include\` statement.

      `)
    }
  })

  test('enforce empty include, if no relation', () => {
    const ast = {
      include: {
        asd: true,
      },
    }

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'query',
      rootField: 'findManyNoRelations',
      extensions: MergedExtensionsList.empty(),
    })

    expect(String(document)).toMatchSnapshot()
    try {
      document.validate(ast, false)
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`

        Invalid \`prisma.asd()\` invocation:

        {
          include: {
            asd: true
            ~~~
          }
        }


        Unknown field \`asd\` for include statement on model NoRelations.
        This model has no relations, so you can't use include with it.

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
      extensions: MergedExtensionsList.empty(),
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
      extensions: MergedExtensionsList.empty(),
    })

    expect(String(document)).toMatchInlineSnapshot(`
      query {
        findManyUser {
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
          posts {
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
    expect(() => document.validate(ast)).not.toThrow()
  })

  test('allow deep include without another include', () => {
    const ast = {
      include: {
        posts: { take: 20 },
      },
    }

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'query',
      rootField: 'findManyUser',
      extensions: MergedExtensionsList.empty(),
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
      extensions: MergedExtensionsList.empty(),
    })

    expect(String(document)).toMatchSnapshot()
    try {
      document.validate(ast, false)
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`

Invalid \`prisma.id()\` invocation:

{
  include: {
    id: true,
    ~~
?   author?: true,
?   categories?: true,
?   _count?: true
  }
}


Invalid scalar field \`id\` for include statement on model Post. Available options are listed in green.
Note, that include statements only accept relation fields.

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
      extensions: MergedExtensionsList.empty(),
    })

    expect(String(document)).toMatchSnapshot()
    try {
      document.validate(ast, false)
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`

Invalid \`prisma.mauthor()\` invocation:

{
  include: {
    mauthor: true,
    ~~~~~~~
?   author?: true,
?   categories?: true,
?   _count?: true
  }
}


Unknown field \`mauthor\` for include statement on model Post. Available options are listed in green. Did you mean \`author\`?

`)
    }
  })

  test('allow include with a select', () => {
    const ast = {
      include: {
        posts: {
          take: 20,
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
      extensions: MergedExtensionsList.empty(),
    })

    expect(String(document)).toMatchInlineSnapshot(`
      query {
        findManyUser {
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
          posts(take: 20) {
            id
          }
        }
      }
    `)
    expect(() => document.validate(ast)).not.toThrow()
  })

  test('allow include with a select with an include', () => {
    const ast = {
      include: {
        posts: {
          take: 20,
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
      extensions: MergedExtensionsList.empty(),
    })

    expect(String(document)).toMatchInlineSnapshot(`
      query {
        findManyUser {
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
          posts(take: 20) {
            id
            author {
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
              posts {
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
        }
      }
    `)
    expect(() => document.validate(ast)).not.toThrow()
  })
})
