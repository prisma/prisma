import stripAnsi from 'strip-ansi'
import { enums } from '../fixtures/enums'
import { DMMFClass, makeDocument } from '../runtime'
import { getDMMF } from '../generation/getDMMF'

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
    })
    expect(String(document)).toMatchInlineSnapshot(`
      "query {
        findManyUser(where: {
          OR: {
            \\"email\\": {}
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
      }"
    `)
    try {
      document.validate(select, false, 'users')
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
        "
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
          id?: String | StringFilter
          name?: String | StringFilter
          email?: String | StringFilter
          status?: String | StringFilter
          favoriteTree?: Tree | TreeFilter
          locationId?: Int | IntFilter
          posts?: PostFilter
          AND?: UserWhereInput
          OR?: UserWhereInput
          NOT?: UserWhereInput
          location?: LocationWhereInput
        }

        "
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
    })
    expect(String(document)).toMatchSnapshot()
    expect(() => document.validate(select, false, 'users')).not.toThrow()
  })
})
