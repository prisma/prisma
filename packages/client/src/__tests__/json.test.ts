import chalk from 'chalk'

import { getDMMF } from '../generation/getDMMF'
import { DMMFClass, makeDocument, objectEnumValues, transformDocument } from '../runtime'

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

chalk.level = 0

const datamodel = `\
datasource db {
  provider = "postgres"
  url = env("DB")
}

model User {
  id       Int @id @default(autoincrement())
  name     String
  email    String @unique
  json     Json
  jsonList Json[]
}


model OptionalUser {
  id    Int @id @default(autoincrement())
  name  String
  email String @unique
  json  Json?
}
`

// TODO: Windows: tests fail because packages/client/helpers/jestSnapshotSerializer
// breaks JSON args by replacing backslashes with forward slashes:
//
//   query {
//     findManyUser(where: {
//       json: {
// -       equals: "{\"hello\":\"world\"}"
// +       equals: "{/"hello/":/"world/"}"
//       }
//     }) {
//
describeIf(process.platform !== 'win32')('json', () => {
  let dmmf

  beforeAll(async () => {
    const dmmfDocument = await getDMMF({ datamodel })
    dmmf = new DMMFClass(dmmfDocument)
  })

  test('should be able to create json', () => {
    const document = makeDocument({
      dmmf,
      select: {
        data: {
          email: 'a@a.de',
          json: {
            hello: 'world',
          },
          jsonList: [{ hello: 'world' }],
          name: 'Bob',
        },
      },
      rootTypeName: 'mutation',
      rootField: 'createOneUser',
      extensions: [],
    })
    document.validate(undefined, false, 'user', 'colorless')
    expect(String(document)).toMatchSnapshot()
  })

  test('should be able filter json', () => {
    const document = makeDocument({
      dmmf,
      select: {
        where: {
          json: {
            equals: {
              hello: 'world',
            },
          },
        },
      },
      rootTypeName: 'query',
      rootField: 'findManyUser',
      extensions: [],
    })
    document.validate(undefined, false, 'user', 'colorless')
    expect(String(document)).toMatchSnapshot()
  })

  test('should be able filter json null', () => {
    const document = makeDocument({
      dmmf,
      select: {
        where: {
          json: {
            equals: objectEnumValues.instances.JsonNull,
          },
        },
      },
      rootTypeName: 'query',
      rootField: 'findManyOptionalUser',
      extensions: [],
    })
    document.validate(undefined, false, 'user', 'colorless')
    expect(String(document)).toMatchSnapshot()
  })

  test('should not consider "JsonNull" string an enum value', () => {
    const document = makeDocument({
      dmmf,
      select: {
        where: {
          json: {
            equals: 'JsonNull',
          },
        },
      },
      rootTypeName: 'query',
      rootField: 'findManyOptionalUser',
      extensions: [],
    })
    document.validate(undefined, false, 'user', 'colorless')
    expect(String(document)).toMatchSnapshot()
  })

  test('should be able filter json "null"', () => {
    const document = makeDocument({
      dmmf,
      select: {
        where: {
          json: {
            equals: 'null',
          },
        },
      },
      rootTypeName: 'query',
      rootField: 'findManyOptionalUser',
      extensions: [],
    })
    document.validate(undefined, false, 'user', 'colorless')
    expect(String(document)).toMatchSnapshot()
  })

  test('should error if equals is missing', () => {
    const document = makeDocument({
      dmmf,
      select: {
        where: {
          json: {
            hello: 'world',
          },
        },
      },
      rootTypeName: 'query',
      rootField: 'findManyUser',
      extensions: [],
    })
    expect(() => document.validate(undefined, false, 'user', 'colorless')).toThrowErrorMatchingSnapshot()
  })

  test('should be able to update json', () => {
    function getTransformedDocument(select) {
      const document = makeDocument({
        dmmf,
        select,
        rootTypeName: 'mutation',
        rootField: 'updateOneUser',
        extensions: [],
      })
      return String(transformDocument(document))
    }

    const transformedDocument = getTransformedDocument({
      data: {
        json: ['value1', 'value2'],
        jsonList: ['value1', 'value2'],
      },
      where: {
        id: 5,
      },
    })

    expect(transformedDocument).toMatchInlineSnapshot(`
      mutation {
        updateOneUser(
          data: {
            json: "[\\"value1\\",\\"value2\\"]"
            jsonList: ["\\"value1\\"","\\"value2\\""]
          }
          where: {
            id: 5
          }
        ) {
          id
          name
          email
          json
          jsonList
        }
      }
    `)
  })
})
