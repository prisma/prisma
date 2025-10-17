import { stripVTControlCharacters } from 'node:util'

import { jestConsoleContext, jestContext } from '@prisma/get-platform'
import path from 'path'

import { loadSchemaContext } from '../../cli/schemaContext'
import { GeneratorRegistry, getGenerators } from '../../get-generators/getGenerators'
import { omit } from '../../utils/omit'
import { pick } from '../../utils/pick'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

if (process.env.CI) {
  // 20s is often not enough on CI, especially on macOS.
  jest.setTimeout(60_000)
} else {
  jest.setTimeout(20_000)
}

let generatorPath = path.join(__dirname, 'generator')

if (process.platform === 'win32') {
  generatorPath += '.cmd'
}

expect.addSnapshotSerializer({
  test: (val) =>
    val && typeof val === 'object' && typeof val['sourceFilePath'] === 'string' && path.isAbsolute(val.sourceFilePath),
  serialize(val, config, indentation, depth, refs, printer) {
    const newVal = { ...val, sourceFilePath: path.relative(__dirname, val.sourceFilePath) }
    return printer(newVal, config, indentation, depth, refs)
  },
})

expect.addSnapshotSerializer({
  test: (val) => typeof val === 'string' && val.includes(__dirname),
  serialize(val, config, indentation, depth, refs, printer) {
    const newVal = val.replaceAll(__dirname, '/project')
    return printer(newVal, config, indentation, depth, refs)
  },
})

const registry = {
  'predefined-generator': {
    type: 'rpc',
    generatorPath: generatorPath,
  },
} satisfies GeneratorRegistry

describe('getGenerators', () => {
  test('basic', async () => {
    const schemaContext = await loadSchemaContext({
      schemaPathFromArg: path.join(__dirname, 'valid-minimal-schema.prisma'),
    })
    const generators = await getGenerators({
      schemaContext,
      registry,
    })

    expect(generators.map((g) => g.manifest)).toMatchInlineSnapshot(`
      [
        {
          "defaultOutput": "/project",
          "denylist": [
            "SomeForbiddenType",
          ],
          "prettyName": "This is a pretty name",
          "requiresEngines": [
            "queryEngine",
            "schemaEngine",
          ],
        },
      ]
    `)

    expect(pick(generators[0].options!, ['datamodel', 'datasources', 'otherGenerators'])).toMatchInlineSnapshot(`
      {
        "datamodel": "datasource db {
        provider = "sqlite"
        url      = "file:./dev.db"
      }

      generator gen {
        provider = "predefined-generator"
      }

      model User {
        id   Int    @id
        name String
      }
      ",
        "datasources": [
          {
            "activeProvider": "sqlite",
            "name": "db",
            "provider": "sqlite",
            "schemas": [],
            "sourceFilePath": "valid-minimal-schema.prisma",
            "url": {
              "fromEnvVar": null,
              "value": "file:./dev.db",
            },
          },
        ],
        "otherGenerators": [],
      }
    `)

    expect(omit(generators[0].options!.generator, ['output'])).toMatchInlineSnapshot(`
      {
        "config": {},
        "name": "gen",
        "previewFeatures": [],
        "provider": {
          "fromEnvVar": null,
          "value": "predefined-generator",
        },
        "sourceFilePath": "valid-minimal-schema.prisma",
      }
    `)

    generators.forEach((g) => g.stop())
  })

  test('filter generator names', async () => {
    const registry = {
      'predefined-generator-1': {
        type: 'rpc',
        generatorPath: generatorPath,
      },
      'predefined-generator-2': {
        type: 'rpc',
        generatorPath: generatorPath,
      },
      'predefined-generator-3': {
        type: 'rpc',
        generatorPath: generatorPath,
      },
    } satisfies GeneratorRegistry

    const schemaContext = await loadSchemaContext({
      schemaPathFromArg: path.join(__dirname, 'multiple-generators-schema.prisma'),
    })
    const generators = await getGenerators({
      schemaContext,
      registry,
      generatorNames: ['client_1', 'client_3'],
    })

    expect(generators).toHaveLength(2)
    expect(generators[0].config.name).toEqual('client_1')
    expect(generators[0].getProvider()).toEqual('predefined-generator-1')
    expect(generators[1].config.name).toEqual('client_3')
    expect(generators[1].getProvider()).toEqual('predefined-generator-3')

    generators.forEach((g) => g.stop())
  })

  test('fail if datasource is missing', async () => {
    expect.assertions(5)
    const schemaContext = await loadSchemaContext({
      schemaPathFromArg: path.join(__dirname, 'missing-datasource-schema.prisma'),
    })

    try {
      await getGenerators({
        schemaContext,
        registry,
      })
    } catch (e) {
      expect(stripVTControlCharacters(e.message)).toMatchInlineSnapshot(`
        "
        You don't have any datasource defined in your schema.prisma.
        You can define a datasource like this:

        datasource db {
          provider = "postgresql"
          url      = env("DB_URL")
        }

        More information in our documentation:
        https://pris.ly/d/prisma-schema
        "
      `)
    }

    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('fail if no model(s) found and allow-no-models flag is false - sqlite', async () => {
    expect.assertions(5)
    const schemaContext = await loadSchemaContext({
      schemaPathFromArg: path.join(__dirname, 'missing-models-sqlite-schema.prisma'),
    })

    try {
      await getGenerators({
        schemaContext,
        registry,
        allowNoModels: false,
      })
    } catch (e) {
      expect(stripVTControlCharacters(e.message)).toMatchInlineSnapshot(`
        "
        You don't have any models defined in your schema.prisma, so nothing will be generated.
        You can define a model like this:

        model User {
          id    Int     @id @default(autoincrement())
          email String  @unique
          name  String?
        }

        More information in our documentation:
        https://pris.ly/d/prisma-schema
        "
      `)
    }

    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('fail if no model(s) found and allow-no-models flag is false - mongodb', async () => {
    expect.assertions(5)
    const schemaContext = await loadSchemaContext({
      schemaPathFromArg: path.join(__dirname, 'missing-models-mongodb-schema.prisma'),
      ignoreEnvVarErrors: true,
    })

    try {
      await getGenerators({
        schemaContext,
        registry,
        allowNoModels: false,
      })
    } catch (e) {
      expect(stripVTControlCharacters(e.message)).toMatchInlineSnapshot(`
        "
        You don't have any models defined in your schema.prisma, so nothing will be generated.
        You can define a model like this:

        model User {
          id    String  @id @default(auto()) @map("_id") @db.ObjectId
          email String  @unique
          name  String?
        }

        More information in our documentation:
        https://pris.ly/d/prisma-schema
        "
      `)
    }

    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('fail if generator not found', async () => {
    expect.assertions(1)

    const registry = {
      'predefined-generator-1': {
        type: 'rpc',
        generatorPath: generatorPath,
      },
      'predefined-generator-2': {
        type: 'rpc',
        generatorPath: generatorPath,
      },
      'predefined-generator-3': {
        type: 'rpc',
        generatorPath: generatorPath,
      },
    } satisfies GeneratorRegistry

    const schemaContext = await loadSchemaContext({
      schemaPathFromArg: path.join(__dirname, 'multiple-generators-schema.prisma'),
    })

    try {
      await getGenerators({
        schemaContext,
        registry,
        generatorNames: ['client_1', 'invalid_generator'],
      })
    } catch (e) {
      expect(stripVTControlCharacters(e.message)).toMatchInlineSnapshot(
        `"The generator invalid_generator specified via --generator does not exist in your Prisma schema"`,
      )
    }
  })

  test('pass if no model(s) found but allow-no-models flag is true - sqlite', async () => {
    expect.assertions(1)

    const schemaContext = await loadSchemaContext({
      schemaPathFromArg: path.join(__dirname, 'missing-models-sqlite-schema.prisma'),
    })

    const generators = await getGenerators({
      schemaContext,
      registry,
      allowNoModels: true,
    })

    generators.forEach((g) => g.stop())

    return expect(generators.length).toBeGreaterThanOrEqual(1)
  })

  test('pass if no model(s) found but allow-no-models flag is true - mongodb', async () => {
    expect.assertions(1)

    const registry = {
      'prisma-client-js': {
        type: 'rpc',
        generatorPath: generatorPath,
      },
    } satisfies GeneratorRegistry

    const schemaContext = await loadSchemaContext({
      schemaPathFromArg: path.join(__dirname, 'missing-models-mongodb-schema.prisma'),
      ignoreEnvVarErrors: true,
    })

    const generators = await getGenerators({
      schemaContext,
      registry,
      allowNoModels: true,
    })

    expect(generators.length).toBeGreaterThanOrEqual(1)

    generators.forEach((g) => g.stop())
  })
})
