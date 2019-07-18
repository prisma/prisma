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
        Invalid \`photon.findManyPost()\` invocation:

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
                Invalid \`photon.id()\` invocation:

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
                        Invalid \`photon.mauthor()\` invocation:

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
})
