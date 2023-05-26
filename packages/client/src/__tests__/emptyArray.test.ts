import { getDMMF } from '@prisma/internals'

import { enums } from '../fixtures/enums'
import { DMMFClass, makeDocument } from '../runtime'
import { MergedExtensionsList } from '../runtime/core/extensions/MergedExtensionsList'

let dmmf
beforeAll(async () => {
  dmmf = new DMMFClass(await getDMMF({ datamodel: enums }))
})

test('does not turn empty array into empty object', () => {
  const select = {
    where: {
      AND: [[]],
    },
  }
  const document = makeDocument({
    dmmf,
    select,
    rootTypeName: 'query',
    rootField: 'findManyUser',
    extensions: MergedExtensionsList.empty(),
  })
  expect(() => document.validate(select, false, 'findMany')).toThrowErrorMatchingInlineSnapshot(`

    Invalid \`prisma.findMany()\` invocation:

    {
      where: {
        AND: [
          []
          ~~
        ]
      }
    }

    Argument 0: Got invalid value [] on prisma.findManyUser. Provided List<>, expected UserWhereInput:
    type UserWhereInput {
      AND?: UserWhereInput | List<UserWhereInput>
      OR?: List<UserWhereInput>
      NOT?: UserWhereInput | List<UserWhereInput>
      id?: StringFilter | String
      name?: StringFilter | String
      email?: StringFilter | String
      status?: StringFilter | String
      nicknames?: StringNullableListFilter
      permissions?: EnumPermissionNullableListFilter
      favoriteTree?: EnumTreeFilter | Tree
      locationId?: IntFilter | Int
      someFloats?: FloatNullableListFilter
      location?: LocationRelationFilter | LocationWhereInput
      posts?: PostListRelationFilter
    }


  `)
  expect(String(document)).toMatchInlineSnapshot(`
    query {
      findManyUser(where: {
        AND: [
          []
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
})
