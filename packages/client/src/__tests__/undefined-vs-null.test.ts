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

describe('select validation', () => {
  test('null when undefined is allowed', () => {
    const select = {
      data: {
        id: null,
      },
      where: {
        id: 'abc',
      },
    }

    const document = makeDocument({
      dmmf,
      select,
      rootTypeName: 'mutation',
      rootField: 'updateOnePost',
      extensions: MergedExtensionsList.empty(),
    })

    expect(String(document)).toMatchSnapshot()
    try {
      document.validate(select)
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`

        Invalid \`prisma.updateOnePost()\` invocation:

        {
          data: {
            id: null
                ~~~~
          },
          where: {
            id: 'abc'
          }
        }

        Argument id for data.id must not be null. Please use undefined instead.


      `)
    }
  })
  test('null when undefined is not allowed', () => {
    const select = {
      data: {
        published: true,
        title: null,
      },
    }

    const document = makeDocument({
      dmmf,
      select,
      rootTypeName: 'mutation',
      rootField: 'createOnePost',
      extensions: MergedExtensionsList.empty(),
    })

    expect(String(document)).toMatchSnapshot()
    try {
      document.validate(select)
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`

                                                        Invalid \`prisma.createOnePost()\` invocation:

                                                        {
                                                          data: {
                                                            published: true,
                                                            title: null
                                                                   ~~~~
                                                          }
                                                        }

                                                        Argument title: Got invalid value null on prisma.createOnePost. Provided null, expected String.


                                          `)
    }
  })
})
