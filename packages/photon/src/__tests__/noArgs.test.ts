import { recommender } from '../fixtures/recommender'
import { DMMFClass, makeDocument } from '../runtime'
import { getDMMF } from '../generation/getDMMF'

let dmmf
describe('no args', () => {
  beforeAll(async () => {
    dmmf = new DMMFClass(await getDMMF({ datamodel: recommender }))
  })

  test('findOne', () => {
    const document = makeDocument({
      dmmf,
      select: undefined,
      rootTypeName: 'query',
      rootField: 'findOneUser',
    })
    expect(() => document.validate(undefined, false, 'user', 'colorless'))
      .toThrowErrorMatchingInlineSnapshot(`
      "
      Invalid \`prisma.user()\` invocation:

      {
      + where: {
      +   id?: Int,
      +   email?: String
      + }
      }

      Argument where is missing.

      Note: Lines with + are required
      "
    `)
  })

  test('findMany', () => {
    const document = makeDocument({
      dmmf,
      select: undefined,
      rootTypeName: 'query',
      rootField: 'findManyUser',
    })
    document.validate(undefined, false, 'user', 'colorless')
    expect(String(document)).toMatchInlineSnapshot(`
      "query {
        findManyUser {
          id
          name
          email
          personaId
        }
      }"
    `)
  })
  test('findMany', () => {
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
    })
    document.validate(select, false, 'user', 'colorless')
    expect(String(document)).toMatchInlineSnapshot(`
      "query {
        findManyUser(where: {

        }) {
          id
          name
          email
          personaId
        }
      }"
    `)
  })
  test('createOne', () => {
    const document = makeDocument({
      dmmf,
      select: undefined,
      rootTypeName: 'mutation',
      rootField: 'createOneUser',
    })
    expect(() => document.validate(undefined, false, 'user', 'colorless'))
      .toThrowErrorMatchingInlineSnapshot(`
      "
      Invalid \`prisma.user()\` invocation:

      {
      + data: {
      +   id: Int,
      +   name: String,
      +   email: String,
      +   likedArticles?: ArticleCreateManyWithoutLikedByInput,
      +   persona: PersonaCreateOneWithoutUserInput
      + }
      }

      Argument data is missing.

      Note: Lines with + are required
      "
    `)
  })
  test('deleteMany', () => {
    const document = makeDocument({
      dmmf,
      select: undefined,
      rootTypeName: 'mutation',
      rootField: 'deleteManyUser',
    })
    document.validate(undefined, false, 'user', 'colorless')
    expect(String(document)).toMatchInlineSnapshot(`
      "mutation {
        deleteManyUser {
          count
        }
      }"
    `)
  })
  test('deleteOne', () => {
    const document = makeDocument({
      dmmf,
      select: undefined,
      rootTypeName: 'mutation',
      rootField: 'deleteOneUser',
    })
    expect(() => document.validate(undefined, false, 'user', 'colorless'))
      .toThrowErrorMatchingInlineSnapshot(`
      "
      Invalid \`prisma.user()\` invocation:

      {
      + where: {
      +   id?: Int,
      +   email?: String
      + }
      }

      Argument where is missing.

      Note: Lines with + are required
      "
    `)
  })
  test('updateMany', () => {
    const document = makeDocument({
      dmmf,
      select: undefined,
      rootTypeName: 'mutation',
      rootField: 'updateManyUser',
    })
    expect(() => document.validate(undefined, false, 'user', 'colorless'))
      .toThrowErrorMatchingInlineSnapshot(`
      "
      Invalid \`prisma.user()\` invocation:

      {
      + data: {
      +   id?: Int,
      +   name?: String,
      +   email?: String
      + },
      ? where?: {
      ?   id?: Int,
      ?   name?: String,
      ?   email?: String,
      ?   likedArticles?: ArticleFilter,
      ?   personaId?: Int,
      ?   AND?: UserWhereInput,
      ?   OR?: UserWhereInput,
      ?   NOT?: UserWhereInput,
      ?   persona?: PersonaWhereInput
      ? }
      }

      Argument data is missing.

      Note: Lines with + are required, lines with ? are optional.
      "
    `)
  })
  test('upsertOne', () => {
    const document = makeDocument({
      dmmf,
      select: undefined,
      rootTypeName: 'mutation',
      rootField: 'upsertOneUser',
    })
    expect(() => document.validate(undefined, false, 'user', 'colorless'))
      .toThrowErrorMatchingInlineSnapshot(`
      "
      Invalid \`prisma.user()\` invocation:

      {
      + where: {
      +   id?: Int,
      +   email?: String
      + },
      + create: {
      +   id: Int,
      +   name: String,
      +   email: String,
      +   likedArticles?: ArticleCreateManyWithoutLikedByInput,
      +   persona: PersonaCreateOneWithoutUserInput
      + },
      + update: {
      +   id?: Int,
      +   name?: String,
      +   email?: String,
      +   likedArticles?: ArticleUpdateManyWithoutLikedByInput,
      +   persona?: PersonaUpdateOneRequiredWithoutUserInput
      + }
      }

      Argument where is missing.
      Argument create is missing.
      Argument update is missing.

      Note: Lines with + are required
      "
    `)
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
    })
    expect(() => document.validate(undefined, false, 'user', 'colorless'))
      .toThrowErrorMatchingInlineSnapshot(`
      "
      Invalid \`prisma.user()\` invocation:

      {
        data: {
          likedArticles: {
            connect: {
      ?       id?: Int,
      ?       url?: String
            }
          }
        }
      }

      Argument data.likedArticles.connect of type ArticleWhereUniqueInput needs at least one argument. Available args are listed in green.

      Note: Lines with ? are optional.
      "
    `)
  })
})
