import { getDMMF, getConfig, dmmfToDml } from '../engineCommands'

describe('getDMMF', () => {
  test('simple model', async () => {
    const dmmf = await getDMMF(`model A {
    id Int @id
    name String
  }`)

    expect(dmmf.datamodel).toMatchInlineSnapshot(`
      Object {
        "enums": Array [],
        "models": Array [
          Object {
            "dbName": null,
            "fields": Array [
              Object {
                "dbName": null,
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
                "dbName": null,
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
          },
        ],
      }
    `)
    expect(dmmf).toMatchSnapshot()
  })
})

describe('getConfig', () => {
  test('empty config', async () => {
    const config = await getConfig(`model A {
      id Int @id
      name String
    }`)

    expect(config).toMatchSnapshot()
  })

  test('with generator and datasource', async () => {
    const config = await getConfig(`
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
    }`)

    expect(config).toMatchSnapshot()
  })
})

describe('dmmfToDml', () => {
  test('basic usage', async () => {
    const datamodel = `
    datasource db {
      url = "file:dev.db"
      provider = "sqlite"
    }

    generator gen {
      provider = "fancy-provider"
      platforms = ["native"]
    }

    model A {
      id Int @id
      name String
    }`
    const dmmf = await getDMMF(datamodel)
    const config = await getConfig(datamodel)

    const printedDatamodel = await dmmfToDml({
      dmmf: dmmf.datamodel,
      config,
    })

    expect(printedDatamodel).toMatchInlineSnapshot(`
      "generator gen {
        provider  = \\"fancy-provider\\"
        platforms = \\"(array)\\"
      }

      datasource db {
        provider = \\"sqlite\\"
        url      = \\"file:dev.db\\"
      }

      model A {
        id   Int    @id
        name String
      }"
    `)
  })
})
