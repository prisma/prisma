import stripAnsi from 'strip-ansi'
import { enums } from '../fixtures/enums'
import { DMMFClass, makeDocument } from '../runtime'
import { getDMMF } from '../utils/getDMMF'

describe('at least one validation', () => {
  const dmmf = new DMMFClass(getDMMF(enums))
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
      rootField: 'users',
    })
    expect(String(document)).toMatchSnapshot()
    try {
      document.validate(select)
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
        "

        Invalid \`photon.users()\` invocation:

        {
          where: {
            email: {
        +     equals?: String,
        +     not?: String | StringFilter,
        +     in?: String,
        +     notIn?: String,
        +     lt?: String,
        +     lte?: String,
        +     gt?: String,
        +     gte?: String,
        +     contains?: String,
        +     startsWith?: String,
        +     endsWith?: String
            }
          }
        }

        Argument where.email of type StringFilter needs at least one argument. Available args are listed in green.

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
      rootField: 'users',
    })
    expect(String(document)).toMatchSnapshot()
    expect(() => document.validate(select)).not.toThrow()
  })
})
