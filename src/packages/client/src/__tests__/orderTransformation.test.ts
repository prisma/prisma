import stripAnsi from 'strip-ansi'
import { enums } from '../fixtures/enums'
import { DMMFClass, makeDocument, transformDocument } from '../runtime'
import { getDMMF } from '../generation/getDMMF'

describe('where transformation', () => {
  let dmmf
  beforeAll(async () => {
    dmmf = new DMMFClass(await getDMMF({ datamodel: enums }))
  })

  test('transform correctly', () => {
    const select = {
      orderBy: {
        email: 'asc',
        id: 'desc',
      },
    }
    const document = makeDocument({
      dmmf,
      select,
      rootTypeName: 'query',
      rootField: 'findManyUser',
    })
    document.validate(select)
    expect(String(document)).toMatchInlineSnapshot(`
      "query {
        findManyUser(orderBy: {
          email: asc
          id: desc
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
    expect(String(transformDocument(document))).toMatchInlineSnapshot(`
      "query {
        findManyUser(orderBy: {
          email: ASC
          id: DESC
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
          locationId
          someFloats
        }
      }"
    `)
    expect(String(transformDocument(document))).toMatchInlineSnapshot(`
      "query {
        findManyUser(orderBy: {
          email: ASC
          id: ASC
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
          orderBy: {
            email: 'asc',
            id: 'asc'
          }
          ~~~~~~~~~~~~~~~
        }

        Argument orderBy: Provided value 
        {
          email: 'asc',
          id: 'asc'
        }
        of type Json on prisma.findManyUser is not a enum.
        → Possible values: UserOrderByInput.id_ASC, UserOrderByInput.id_DESC, UserOrderByInput.name_ASC, UserOrderByInput.name_DESC, UserOrderByInput.email_ASC, UserOrderByInput.email_DESC, UserOrderByInput.status_ASC, UserOrderByInput.status_DESC, UserOrderByInput.favoriteTree_ASC, UserOrderByInput.favoriteTree_DESC, UserOrderByInput.locationId_ASC, UserOrderByInput.locationId_DESC

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
          locationId
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
          locationId
          someFloats
        }
      }"
    `)
  })
})
