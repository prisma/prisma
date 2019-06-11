import stripAnsi from 'strip-ansi'
import { enums } from '../fixtures/enums'
import { DMMFClass, makeDocument, transformDocument } from '../runtime'
import { getDMMF } from '../utils/getDMMF'

describe('where transformation', () => {
  let dmmf
  beforeEach(async () => {
    dmmf = new DMMFClass(await getDMMF(enums))
  })

  test('transform correctly', () => {
    const select = {
      orderBy: {
        email: 'asc',
        // id: 'asc',
      },
    }
    const document = makeDocument({
      dmmf,
      select,
      rootTypeName: 'query',
      rootField: 'users',
    })
    expect(String(document)).toMatchInlineSnapshot(`
            "query {
              users(orderBy: {
                email: \\"asc\\"
              }) {
                id
                name
                email
                status
                nicknames
              }
            }"
        `)
    expect(String(transformDocument(document))).toMatchInlineSnapshot(`
            "query {
              users(orderBy: email_ASC) {
                id
                name
                email
                status
                nicknames
              }
            }"
        `)
  })

  test('throw when 2 order by args provided', () => {
    const select = {
      orderBy: {
        email: 'asc',
        id: 'asc',
      },
    }
    const document = makeDocument({
      dmmf,
      select,
      rootTypeName: 'query',
      rootField: 'users',
    })
    expect(String(document)).toMatchInlineSnapshot(`
            "query {
              users(orderBy: {
                email: \\"asc\\"
                id: \\"asc\\"
              }) {
                id
                name
                email
                status
                nicknames
              }
            }"
        `)
    expect(String(transformDocument(document))).toMatchInlineSnapshot(`
            "query {
              users(orderBy: email_ASC) {
                id
                name
                email
                status
                nicknames
              }
            }"
        `)
    try {
      document.validate(select)
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
        "

        Invalid \`photon.users()\` invocation

        {
          orderBy: {
            email: 'asc',
            id: 'asc'
          }
          ~~~~~~~~~~~~~~~
        }

        Argument orderBy of type UserOrderByInput needs exactly one argument, but you provided email and id. Please choose one. Available args: 
        type UserOrderByInput {
          id?: OrderByArg
          name?: OrderByArg
          email?: OrderByArg
          status?: OrderByArg
          favoriteTree?: OrderByArg
        }

        "
      `)
    }
  })
})
