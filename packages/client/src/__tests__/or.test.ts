import stripAnsi from 'strip-ansi'

import { enums } from '../fixtures/enums'
import { getDMMF } from '../generation/getDMMF'
import { DMMFClass, makeDocument } from '../runtime'
import { MergedExtensionsList } from '../runtime/core/extensions/ExtensionsList'

describe('at least one validation', () => {
  let dmmf
  beforeAll(async () => {
    dmmf = new DMMFClass(await getDMMF({ datamodel: enums }))
  })

  test('invalid or query', () => {
    const select = {
      where: {
        OR: {
          email: {},
        },
      },
    }
    const document = makeDocument({
      dmmf,
      select,
      rootTypeName: 'query',
      rootField: 'findManyUser',
      extensions: MergedExtensionsList.empty(),
    })
    expect(String(document)).toMatchInlineSnapshot(`
      query {
        findManyUser(where: {
          OR: [
            {
              email: {

              }
            }
          ]
        }) {
          id
          name
          email
          status
          nicknames
          permissions
          favoriteTree
          locationId
          someFloats
        }
      }
    `)
    try {
      document.validate(select, false, 'users')
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`

                                        Invalid \`prisma.users()\` invocation:

                                        {
                                          where: {
                                            OR: {
                                              email: {}
                                            }
                                            ~~~~~~~~~~~
                                          }
                                        }

                                        Argument OR: Got invalid value 
                                        {
                                          email: {}
                                        }
                                        on prisma.findManyUser. Provided Json, expected List<UserWhereInput>:
                                        type UserWhereInput {
                                          AND?: UserWhereInput
                                          OR?: UserWhereInput
                                          NOT?: UserWhereInput
                                          id?: StringFilter | String
                                          name?: StringFilter | String
                                          email?: StringFilter | String
                                          status?: StringFilter | String
                                          nicknames?: StringNullableListFilter
                                          permissions?: EnumPermissionNullableListFilter
                                          favoriteTree?: EnumTreeFilter | Tree
                                          locationId?: IntFilter | Int
                                          location?: LocationRelationFilter | LocationWhereInput
                                          posts?: PostListRelationFilter
                                          someFloats?: FloatNullableListFilter
                                        }


                              `)
    }
  })
  test('valid or query', () => {
    const select = {
      where: {
        OR: [
          {
            email: '',
          },
        ],
      },
    }
    const document = makeDocument({
      dmmf,
      select,
      rootTypeName: 'query',
      rootField: 'findManyUser',
      extensions: MergedExtensionsList.empty(),
    })
    expect(String(document)).toMatchSnapshot()
    expect(() => document.validate(select, false, 'users')).not.toThrow()
  })
})
