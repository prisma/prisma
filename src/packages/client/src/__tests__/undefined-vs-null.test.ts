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

        Argument id: Got invalid value null on prisma.updateOnePost. Provided null, expected String or StringFieldUpdateOperationsInput:
        type StringFieldUpdateOperationsInput {
          set?: String
        }
        type StringFieldUpdateOperationsInput {
          set?: String
        }


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
