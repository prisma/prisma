import { getDMMF, getConfig } from '../engineCommands'
import stripAnsi from 'strip-ansi'
import fs from 'fs'
import path from 'path'

jest.setTimeout(10000)

describe('getDMMF', () => {
  test('simple model', async () => {
    const dmmf = await getDMMF({
      datamodel: `model A {
    id Int @id
    name String
  }`,
    })

    expect(dmmf.datamodel).toMatchInlineSnapshot(`
      Object {
        "enums": Array [],
        "models": Array [
          Object {
            "dbName": null,
            "fields": Array [
              Object {
                "dbNames": Array [],
                "isGenerated": false,
                "isId": true,
                "isList": false,
                "isRequired": true,
                "isUnique": false,
                "isUpdatedAt": false,
                "kind": "scalar",
                "name": "id",
                "type": "Int",
              },
              Object {
                "dbNames": Array [],
                "isGenerated": false,
                "isId": false,
                "isList": false,
                "isRequired": true,
                "isUnique": false,
                "isUpdatedAt": false,
                "kind": "scalar",
                "name": "name",
                "type": "String",
              },
            ],
            "idFields": Array [],
            "isEmbedded": false,
            "isGenerated": false,
            "name": "A",
            "uniqueFields": Array [],
          },
        ],
      }
    `)
    expect(dmmf).toMatchSnapshot()
  })

  test('big schema', async () => {
    const file = fs.readFileSync(
      path.join(__dirname, '../../fixtures/bigschema.prisma'),
      'utf-8',
    )
    const dmmf = await getDMMF({ datamodel: file })
    const str = JSON.stringify(dmmf)
    expect(str.length).toMatchInlineSnapshot(`45252081`)
  })

  test('with validation errors', async () => {
    const datamodel = `generator client {
      provider = "prisma-client-js"
    }
    
    datasource my_db {
      provider = "sqlite"
      url      = "file:dev.db"
    }
    
    model User {
      id           String     @id @default(cuid())
      id           String     @id @default(cuid())
      name         String
      email        String     @unique
      status       String     @default("")
      permissions  Permission @default()
      permissions  Permission @default("")
      posts        Post[]
      posts        Post[]
    }
    
    model Post {
      id        String   @id @default(cuid())
      name      String
      email     String   @unique
      createdAt DateTime @default(now())
      updatedAt DateTime @updatedAt
    }
    
    enum Permission {
      ADMIN
      USER
      OWNER
      COLLABORATOR
    }
    `
    try {
      await getDMMF({ datamodel })
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchSnapshot()
    }
  })
})

describe('getConfig', () => {
  test('empty config', async () => {
    const config = await getConfig({
      datamodel: `model A {
      id Int @id
      name String
    }`,
    })

    expect(config).toMatchSnapshot()
  })

  test('with generator and datasource', async () => {
    const config = await getConfig({
      datamodel: `
    datasource db {
      url = "file:dev.db"
      provider = "sqlite"
    }

    generator gen {
      provider = "fancy-provider"
      binaryTargets = ["native"]
    }

    model A {
      id Int @id
      name String
    }`,
    })

    expect(config).toMatchSnapshot()
  })
})
