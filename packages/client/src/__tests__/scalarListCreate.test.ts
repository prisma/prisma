import chalk from 'chalk'
import { enums } from '../fixtures/enums'
import { DMMFClass, makeDocument, transformDocument } from '../runtime'
import { getDMMF } from '../generation/getDMMF'
chalk.level = 0

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
            set: [1, 1.2]
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
          someFloats: [1, 1.2]
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
