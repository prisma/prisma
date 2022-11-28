import { recommender } from '../fixtures/recommender'
import { getDMMF } from '../generation/getDMMF'
import { DMMFClass, makeDocument } from '../runtime'
import { MergedExtensionsList } from '../runtime/core/extensions/MergedExtensionsList'

let dmmf
describe('no args', () => {
  beforeAll(async () => {
    dmmf = new DMMFClass(await getDMMF({ datamodel: recommender }))
  })

  test('findUnique', () => {
    const document = makeDocument({
      dmmf,
      select: undefined,
      rootTypeName: 'query',
      rootField: 'findUniqueUser',
      extensions: MergedExtensionsList.empty(),
    })
    expect(() => document.validate(undefined, false, 'user', 'colorless')).toThrowErrorMatchingSnapshot()
  })

  test('findMany', () => {
    const document = makeDocument({
      dmmf,
      select: undefined,
      rootTypeName: 'query',
      rootField: 'findManyUser',
      extensions: MergedExtensionsList.empty(),
    })
    document.validate(undefined, false, 'user', 'colorless')
    expect(String(document)).toMatchInlineSnapshot(`
      query {
        findManyUser {
          id
          name
          email
          personaId
        }
      }
    `)
  })
  test('findMany with filter', () => {
    const select = {
      where: {
        likedArticles: null,
      },
    }
    const document = makeDocument({
      dmmf,
      select,
      rootTypeName: 'query',
      rootField: 'findManyUser',
      extensions: MergedExtensionsList.empty(),
    })
    expect(() => document.validate(select, false, 'user', 'colorless')).toThrowErrorMatchingSnapshot()
    expect(String(document)).toMatchInlineSnapshot(`
      query {
        findManyUser(where: {
          likedArticles: null
        }) {
          id
          name
          email
          personaId
        }
      }
    `)
  })
  test('createOne', () => {
    const document = makeDocument({
      dmmf,
      select: undefined,
      rootTypeName: 'mutation',
      rootField: 'createOneUser',
      extensions: MergedExtensionsList.empty(),
    })
    expect(() => document.validate(undefined, false, 'user', 'colorless')).toThrowErrorMatchingSnapshot()
  })
  test('deleteMany', () => {
    const document = makeDocument({
      dmmf,
      select: undefined,
      rootTypeName: 'mutation',
      rootField: 'deleteManyUser',
      extensions: MergedExtensionsList.empty(),
    })
    document.validate(undefined, false, 'user', 'colorless')
    expect(String(document)).toMatchInlineSnapshot(`
      mutation {
        deleteManyUser {
          count
        }
      }
    `)
  })
  test('deleteOne', () => {
    const document = makeDocument({
      dmmf,
      select: undefined,
      rootTypeName: 'mutation',
      rootField: 'deleteOneUser',
      extensions: MergedExtensionsList.empty(),
    })
    expect(() => document.validate(undefined, false, 'user', 'colorless')).toThrowErrorMatchingSnapshot()
  })
  test('updateMany', () => {
    const document = makeDocument({
      dmmf,
      select: undefined,
      rootTypeName: 'mutation',
      rootField: 'updateManyUser',
      extensions: MergedExtensionsList.empty(),
    })
    expect(() => document.validate(undefined, false, 'user', 'colorless')).toThrowErrorMatchingSnapshot()
  })
  test('upsertOne', () => {
    const document = makeDocument({
      dmmf,
      select: undefined,
      rootTypeName: 'mutation',
      rootField: 'upsertOneUser',
      extensions: MergedExtensionsList.empty(),
    })
    expect(() => document.validate(undefined, false, 'user', 'colorless')).toThrowErrorMatchingSnapshot()
  })
  test('nested create', () => {
    const document = makeDocument({
      dmmf,
      select: {
        data: {
          id: 5,
          name: 'Harshit',
          email: 'a@a.de',
          likedArticles: {
            connect: null,
          },
          persona: {
            create: {
              id: 123,
              isDeveloper: true,
            },
          },
        },
      },
      rootTypeName: 'mutation',
      rootField: 'createOneUser',
      extensions: MergedExtensionsList.empty(),
    })
    expect(() => document.validate(undefined, false, 'user', 'colorless')).toThrowErrorMatchingSnapshot()
  })
})
