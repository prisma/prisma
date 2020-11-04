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
        ?   id?: String | StringFieldUpdateOperationsInput,
        ?   createdAt?: DateTime | DateTimeFieldUpdateOperationsInput,
        ?   updatedAt?: DateTime | DateTimeFieldUpdateOperationsInput,
        ?   published?: Boolean | BoolFieldUpdateOperationsInput,
        ?   title?: String | StringFieldUpdateOperationsInput,
        ?   content?: String | NullableStringFieldUpdateOperationsInput | null,
        ?   optionnal?: Float | NullableFloatFieldUpdateOperationsInput | null,
        ?   author?: {
        ?     create?: UserCreateWithoutPostsInput,
        ?     connect?: UserWhereUniqueInput,
        ?     disconnect?: Boolean,
        ?     delete?: Boolean,
        ?     update?: UserUpdateWithoutPostsInput,
        ?     upsert?: UserUpsertWithoutPostsInput,
        ?     connectOrCreate?: UserCreateOrConnectWithoutpostsInput
        ?   },
        ?   categories?: {
        ?     create?: CategoryCreateWithoutPostsInput | CategoryCreateWithoutPostsInput,
        ?     connect?: CategoryWhereUniqueInput | CategoryWhereUniqueInput,
        ?     set?: CategoryWhereUniqueInput | CategoryWhereUniqueInput,
        ?     disconnect?: CategoryWhereUniqueInput | CategoryWhereUniqueInput,
        ?     delete?: CategoryWhereUniqueInput | CategoryWhereUniqueInput,
        ?     update?: CategoryUpdateWithWhereUniqueWithoutPostsInput | CategoryUpdateWithWhereUniqueWithoutPostsInput,
        ?     updateMany?: CategoryUpdateManyWithWhereWithoutPostsInput | CategoryUpdateManyWithWhereWithoutPostsInput,
        ?     deleteMany?: CategoryScalarWhereInput | CategoryScalarWhereInput,
        ?     upsert?: CategoryUpsertWithWhereUniqueWithoutPostsInput | CategoryUpsertWithWhereUniqueWithoutPostsInput,
        ?     connectOrCreate?: CategoryCreateOrConnectWithoutpostsInput | CategoryCreateOrConnectWithoutpostsInput
        ?   }
          },
          where: {
            id: 'abc'
          }
        }

        Argument data.id of type StringFieldUpdateOperationsInput needs at least one argument. Available args are listed in green.

        Note: Lines with ? are optional.

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
