// import { DMMFClass } from '../runtime/dmmf'
// import { makeDocument } from '../runtime/query'
import { getDMMF } from '../generation/getDMMF'
import chalk from 'chalk'
import { DMMFClass, makeDocument, transformDocument } from '../runtime'
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

let dmmf
beforeAll(async () => {
  const dmmfDocument = await getDMMF({ datamodel })
  dmmf = new DMMFClass(dmmfDocument)
})

describe('json', () => {
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
            equals: 'JsonNull',
          },
        },
      },
      rootTypeName: 'query',
      rootField: 'findManyOptionalUser',
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
