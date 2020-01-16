import stripAnsi from 'strip-ansi'
import { enums } from '../fixtures/enums'
import { DMMFClass, makeDocument, transformDocument } from '../runtime'
import { getDMMF } from '../runtime/getDMMF'

describe('where transformation', () => {
  let dmmf
  beforeAll(async () => {
    dmmf = new DMMFClass(await getDMMF({ datamodel: enums }))
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
      rootField: 'findManyUser',
    })
    expect(String(document)).toMatchInlineSnapshot(`
      "query {
        findManyUser(orderBy: {
          email: asc
        }) {
          id
          name
          email
          status
          nicknames
          permissions
          favoriteTree
          someFloats
        }
      }"
    `)
    expect(String(transformDocument(document))).toMatchInlineSnapshot(`
      "query {
        findManyUser(orderBy: email_ASC) {
          id
          name
          email
          status
          nicknames
          permissions
          favoriteTree
          someFloats
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
      rootField: 'findManyUser',
    })
    expect(String(document)).toMatchInlineSnapshot(`
      "query {
        findManyUser(orderBy: {
          email: asc
          id: asc
        }) {
          id
          name
          email
          status
          nicknames
          permissions
          favoriteTree
          someFloats
        }
      }"
    `)
    expect(String(transformDocument(document))).toMatchInlineSnapshot(`
      "query {
        findManyUser(orderBy: email_ASC) {
          id
          name
          email
          status
          nicknames
          permissions
          favoriteTree
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

  test('ignore order null', () => {
    const select = {
      orderBy: null,
    }
    const document = makeDocument({
      dmmf,
      select,
      rootTypeName: 'query',
      rootField: 'findManyUser',
    })
    expect(String(transformDocument(document))).toMatchInlineSnapshot(`
      "query {
        findManyUser {
          id
          name
          email
          status
          nicknames
          permissions
          favoriteTree
          someFloats
        }
      }"
    `)
  })

  test('ignore order by id null', () => {
    const select = {
      orderBy: { id: null },
    }
    const document = makeDocument({
      dmmf,
      select,
      rootTypeName: 'query',
      rootField: 'findManyUser',
    })
    expect(String(transformDocument(document))).toMatchInlineSnapshot(`
      "query {
        findManyUser(orderBy: {

        }) {
          id
          name
          email
          status
          nicknames
          permissions
          favoriteTree
          someFloats
        }
      }"
    `)
  })
})
