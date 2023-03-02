import { getDMMF } from '@prisma/internals'
import stripAnsi from 'strip-ansi'

import { enums } from '../fixtures/enums'
import { DMMFClass, makeDocument, transformDocument } from '../runtime'
import { MergedExtensionsList } from '../runtime/core/extensions/MergedExtensionsList'

describe('where transformation', () => {
  let dmmf
  beforeAll(async () => {
    dmmf = new DMMFClass(await getDMMF({ datamodel: enums }))
  })

  test('transform correctly', () => {
    const select = {
      orderBy: {
        email: 'asc',
      },
    }
    const document = makeDocument({
      dmmf,
      select,
      rootTypeName: 'query',
      rootField: 'findManyUser',
      extensions: MergedExtensionsList.empty(),
    })
    document.validate(select, false)
    expect(String(document)).toMatchInlineSnapshot(`
      query {
        findManyUser(orderBy: [
          {
            email: asc
          }
        ]) {
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
    expect(String(transformDocument(document))).toMatchInlineSnapshot(`
      query {
        findManyUser(orderBy: [
          {
            email: asc
          }
        ]) {
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
      extensions: MergedExtensionsList.empty(),
    })
    expect(String(document)).toMatchInlineSnapshot(`
      query {
        findManyUser(orderBy: [
          {
            email: asc
            id: asc
          }
        ]) {
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
    expect(String(transformDocument(document))).toMatchInlineSnapshot(`
      query {
        findManyUser(orderBy: [
          {
            email: asc
            id: asc
          }
        ]) {
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
          orderBy: {
            email: 'asc',
            id: 'asc'
          }
          ~~~~~~~~~~~~~~~
        }

        Argument orderBy of type UserOrderByWithRelationInput needs exactly one argument, but you provided email and id. Please choose one. Available args: 
        type UserOrderByWithRelationInput {
          id?: SortOrder
          name?: SortOrder
          email?: SortOrder
          status?: SortOrder
          nicknames?: SortOrder
          permissions?: SortOrder
          favoriteTree?: SortOrder
          locationId?: SortOrder
          someFloats?: SortOrder
          location?: LocationOrderByWithRelationInput
          posts?: PostOrderByRelationAggregateInput
        }


      `)
    }
  })

  /**
   * We used to ignore it. The snapshot then was sth like this:
   * 
      query {
        findManyUser {
          id
          name
          ...

    But not anymore, as Rust does the work now
   */
  test('DO NOT ignore order null', () => {
    const select = {
      orderBy: null,
    }
    const document = makeDocument({
      dmmf,
      select,
      rootTypeName: 'query',
      rootField: 'findManyUser',
      extensions: MergedExtensionsList.empty(),
    })
    expect(String(transformDocument(document))).toMatchInlineSnapshot(`
      query {
        findManyUser(orderBy: null) {
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

  test('ignore order by id null', () => {
    const select = {
      orderBy: { id: null },
    }
    const document = makeDocument({
      dmmf,
      select,
      rootTypeName: 'query',
      rootField: 'findManyUser',
      extensions: MergedExtensionsList.empty(),
    })
    expect(String(transformDocument(document))).toMatchInlineSnapshot(`
      query {
        findManyUser(orderBy: {
          id: null
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
})
