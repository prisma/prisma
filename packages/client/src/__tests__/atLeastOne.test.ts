import stripAnsi from 'strip-ansi'

import { enums } from '../fixtures/enums'
import { getDMMF } from '../generation/getDMMF'
import { DMMFClass, makeDocument } from '../runtime'

describe('at least one validation', () => {
  let dmmf
  beforeAll(async () => {
    dmmf = new DMMFClass(await getDMMF({ datamodel: enums }))
  })

  test('invalid query', () => {
    const select = {
      where: {
        email: {},
      },
    }
    const document = makeDocument({
      dmmf,
      select,
      rootTypeName: 'query',
      rootField: 'findManyUser',
      extensions: [],
    })
    expect(String(document)).toMatchInlineSnapshot(`
      query {
        findManyUser(where: {
          email: {

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
    try {
      document.validate(select, false, 'users')
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
        "
        Invalid \`prisma.users()\` invocation:

        {
          where: {
            email: {
        ?     equals?: String,
        ?     not?: String | StringFilter,
        ?     in?: String,
        ?     notIn?: String,
        ?     lt?: String,
        ?     lte?: String,
        ?     gt?: String,
        ?     gte?: String,
        ?     contains?: String,
        ?     startsWith?: String,
        ?     endsWith?: String
            }
          }
        }

        Argument where.email of type StringFilter needs at least one argument. Available args are listed in green.

        Note: Lines with ? are optional.
        "
      `)
    }
  })

  test('valid query', () => {
    const select = {
      where: {
        email: '',
      },
    }
    const document = makeDocument({
      dmmf,
      select,
      rootTypeName: 'query',
      rootField: 'findManyUser',
      extensions: [],
    })
    expect(String(document)).toMatchSnapshot()
    expect(() => document.validate(select, false, 'users')).not.toThrow()
  })
})
