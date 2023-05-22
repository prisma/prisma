import { getDMMF } from '@prisma/internals'

import { enums } from '../fixtures/enums'
import { DMMFClass, makeDocument, transformDocument } from '../runtime'
import { MergedExtensionsList } from '../runtime/core/extensions/MergedExtensionsList'

describe('scalar where transformation', () => {
  let dmmf
  beforeAll(async () => {
    dmmf = new DMMFClass(await getDMMF({ datamodel: enums }))
  })

  test('allow providing Int and Float scalar list in set', () => {
    const select = {
      data: {
        name: 'Name',
        email: 'hans@hans.de',
        status: '',
        favoriteTree: 'OAK',
        location: {
          create: {
            city: 'Berlin',
            id: 5,
          },
        },
        someFloats: {
          set: [1, 1.2],
        },
      },
    }

    const document = transformDocument(
      makeDocument({
        dmmf,
        select,
        rootTypeName: 'mutation',
        rootField: 'createOneUser',
        extensions: MergedExtensionsList.empty(),
      }),
    )

    expect(String(document)).toMatchInlineSnapshot(`
      mutation {
        createOneUser(data: {
          name: "Name"
          email: "hans@hans.de"
          status: ""
          favoriteTree: OAK
          location: {
            create: {
              city: "Berlin"
              id: 5
            }
          }
          someFloats: {
            set: [1e+0, 1.2e+0]
          }
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

    expect(() => document.validate(select, false, 'tests')).not.toThrow()
  })

  test('allow providing Int and Float scalar list without set', () => {
    const select = {
      data: {
        name: 'Name',
        email: 'hans@hans.de',
        status: '',
        favoriteTree: 'OAK',
        location: {
          create: {
            city: 'Berlin',
            id: 5,
          },
        },
        someFloats: [1, 1.2],
      },
    }

    const document = transformDocument(
      makeDocument({
        dmmf,
        select,
        rootTypeName: 'mutation',
        rootField: 'createOneUser',
        extensions: MergedExtensionsList.empty(),
      }),
    )

    expect(String(document)).toMatchInlineSnapshot(`
      mutation {
        createOneUser(data: {
          name: "Name"
          email: "hans@hans.de"
          status: ""
          favoriteTree: OAK
          location: {
            create: {
              city: "Berlin"
              id: 5
            }
          }
          someFloats: [1e+0, 1.2e+0]
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

    expect(() => document.validate(select, false, 'tests')).not.toThrow()
  })
})
