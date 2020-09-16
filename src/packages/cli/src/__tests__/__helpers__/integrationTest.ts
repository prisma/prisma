import { getLatestTag } from '@prisma/fetch-engine'
import { getGenerator, IntrospectionEngine } from '@prisma/sdk'
import fs from 'fs-jetpack'
import { FSJetpack } from 'fs-jetpack/types'
import * as Path from 'path'
import pkgup from 'pkg-up'

process.setMaxListeners(100)

/**
 * A potentially async value
 */
type MaybePromise<T = void> = Promise<T> | T

/**
 * Configuration for an integration test.
 */
type Scenario = {
  /**
   * Only run this test case (and any others with only set).
   */
  only?: boolean
  /**
   * Do not run this test case.
   */
  todo?: boolean
  /**
   * Name of the test case. Influences the temp dir, snapshot, etc.
   */
  name: string
  /**
   * SQL to put database into pre-test condition.
   */
  up: string
  /**
   * SQL to teardown pre-test condition.
   */
  down: string
  /**
   * Arbitrary Prisma client logic to test.
   */
  do: (client: any) => Promise<any>
  /**
   * Value that the "do" operation should result in.
   */
  expect: any
}

/**
 * Contextual data and API attached to each integration test run.
 */
type Context = {
  /**
   * Jetpack instance bound to the integration test temporary directory.
   */
  fs: FSJetpack
}

/**
 * Integration test database interface.
 */
type Database<Client> = {
  /**
   * Name of the database being worked with.
   *
   * @remarks This is used as the default provider name for the Prisma schema datasource block.
   */
  name: string
  /**
   * Create a client connection to the database.
   */
  connect: (ctx: Context) => MaybePromise<Client>
  /**
   * Execute SQL against the database.
   */
  send: (db: Client, sql: string) => MaybePromise<any>
  /**
   * At the end of _each_ test run logic
   */
  afterEach?: (db: Client) => MaybePromise
  /**
   * At the end of _all_ tests run logic to close the database connection.
   */
  close?: (db: Client) => MaybePromise
  /**
   * Give the connection URL for the Prisma schema datasource block or provide your own custom implementation.
   */
  datasource:
    | {
        /**
         * Construct the whole datasource block for the Prisma schema
         */
        raw: (ctx: Context) => string
      }
    | {
        /**
         * Supply the connection URL used in the datasource block.
         */
        url: string | ((ctx: Context) => string)
        /**
         * Supply the provider name used in the datasource block.
         *
         * @dynamicDefault The value passed to database.name
         */
        provider?: string
      }
}

/**
 * Settings to control things like test timeout and Prisma engine version.
 */
type Settings = {
  /**
   * How long each test case should have to run to completion.
   *
   * @default 15_000
   */
  timeout?: number
  /**
   * The version of Prisma Engine to use.
   *
   * @dynamicDefault The result of `@prisma/fetch-engine#getLatestTag`
   */
  engineVersion?: MaybePromise<string>
}

/**
 * Integration test keyword arguments
 */
type Input<Client> = {
  database: Database<Client>
  scenarios: Scenario[]
  settings?: Settings
}

process.env.SKIP_GENERATE = 'true'
const pkgDir = pkgup.sync() || __dirname
const engine = new IntrospectionEngine()

export function integrationTest<Client>(input: Input<Client>) {
  type ScenarioState = {
    scenario: Scenario
    ctx: Context
    database: Input<Client>['database']
    db: Client
    prisma: any
  }

  let engineVersion
  const state: ScenarioState = {} as any

  beforeAll(async () => {
    // Remove old stuff if it is still around for some reason
    fs.remove(getScenarioDir(input.database.name, ''))
    engineVersion = await (input.settings?.engineVersion
      ? input.settings.engineVersion
      : getLatestTag())
  })

  afterEach(async () => {
    const errors: any[] = []

    // props might be missing if test errors out before they are set.
    if (state.db) {
      await Promise.resolve(input.database.send(state.db, state.scenario.down))
        .catch((e) => errors.push(e))
        .then(() => input.database.afterEach?.(state.db))
        .catch((e) => errors.push(e))
        .then(() => state.prisma?.$disconnect())
        .catch((e) => errors.push(e))
    }

    if (errors.length) {
      // TODO use an error aggreggator lib like "ono"
      throw new Error(
        `Got Errors while running scenario "afterEach" hook: \n-> ${errors.join(
          '\n ->',
        )}`,
      )
    }
  }, 10_000)

  afterAll(async () => {
    engine.stop()
    // props might be missing if test errors out before they are set.
    if (state.db && input.database.close) {
      await input.database.close(state.db)
    }
    fs.remove(getScenarioDir(input.database.name, ''))
  })

  /**
   * it.concurrent.each (https://jestjs.io/docs/en/api#testconcurrenteachtablename-fn-timeout)
   * does not seem to work. Snapshots keep getting errors. And each runs leads to different
   * snapshot errors. Might be related to https://github.com/facebook/jest/issues/2180 but we're
   * explicitly naming our snapshots here so...?
   *
   * If we ever make use of test.concurrent we will need to rethink our ctx system:
   * https://github.com/facebook/jest/issues/10513
   */
  it.each(prepareTestScenarios(input.scenarios))(
    `%s`,
    async (scenarioName, scenario) => {
      const ctx: Context = {} as any
      ctx.fs = fs.cwd(getScenarioDir(input.database.name, scenarioName))
      state.ctx = ctx
      state.scenario = scenario

      await ctx.fs.dirAsync('.')

      const dbClient = await input.database.connect(ctx)

      state.db = dbClient

      await input.database.send(dbClient, scenario.up)

      const datasourceBlock =
        'raw' in input.database.datasource
          ? input.database.datasource.raw(ctx)
          : makeDatasourceBlock(
              input.database.datasource.provider ?? input.database.name,
              typeof input.database.datasource.url === 'function'
                ? input.database.datasource.url(ctx)
                : input.database.datasource.url,
            )

      const schema = `
        generator client {
          provider = "prisma-client-js"
          output   = "${ctx.fs.path()}"
        }

        ${datasourceBlock}
      `

      const introspectionResult = await engine.introspect(schema)
      const datamodel = introspectionResult.datamodel
      const prismaSchemaPath = ctx.fs.path('schema.prisma')

      await fs.writeAsync(prismaSchemaPath, datamodel)
      await generate(prismaSchemaPath, engineVersion)

      const prismaClientPath = ctx.fs.path('index.js')
      const prismaClientDeclarationPath = ctx.fs.path('index.d.ts')

      expect(await fs.existsAsync(prismaClientPath)).toBeTruthy()
      expect(await fs.existsAsync(prismaClientDeclarationPath)).toBeTruthy()

      const { PrismaClient, prismaVersion } = await import(prismaClientPath)

      expect(prismaVersion.client).toMatch(/^2.+/)
      expect(prismaVersion.engine).toEqual(engineVersion)

      state.prisma = new PrismaClient()
      await state.prisma.$connect()

      const result = await scenario.do(state.prisma)

      expect(result).toEqual(scenario.expect)
      expect(prepareSchemaForSnapshot(datamodel)).toMatchSnapshot(`datamodel`)
      expect(introspectionResult.warnings).toMatchSnapshot(`warnings`)
    },
    input.settings?.timeout ?? 15_000,
  )
}

/**
 * Convert test scenarios into something jest.each can consume
 */
function prepareTestScenarios(scenarios: Scenario[]): [string, Scenario][] {
  const onlys = scenarios.filter((scenario) => scenario.only)

  if (onlys.length) {
    return onlys.map((scenario) => [scenario.name, scenario])
  }

  return scenarios
    .filter((scenario) => scenario.todo !== true)
    .map((scenario) => [scenario.name, scenario])
}

/**
 * Get the temporary directory for the scenario
 */
function getScenarioDir(databaseName: string, scenarioName: string) {
  return Path.join(
    Path.dirname(pkgDir),
    'src',
    '__tests__',
    `tmp-integration-test-${databaseName}`,
    scenarioName,
  )
}

/**
 * Run all generators the given Prisma schema
 */
async function generate(schemaPath: string, engineVersion: string) {
  const generator = await getGenerator({
    schemaPath,
    printDownloadProgress: false,
    baseDir: Path.dirname(schemaPath),
    version: engineVersion,
  })

  await generator.generate()

  generator.stop()
}

/**
 * Replace dynamic variable bits of Prisma Schema with static strings.
 */
export function prepareSchemaForSnapshot(schema: string): string {
  const urlRegex = /url\s*=\s*.+/
  const outputRegex = /output\s*=\s*.+/
  return schema
    .split('\n')
    .map((line) => {
      const urlMatch = urlRegex.exec(line)
      if (urlMatch) {
        return `${line.slice(0, urlMatch.index)}url = "***"`
      }
      const outputMatch = outputRegex.exec(line)
      if (outputMatch) {
        return `${line.slice(0, outputMatch.index)}output = "***"`
      }
      return line
    })
    .join('\n')
}

/**
 * Create a Prisma schema datasource block.
 */
function makeDatasourceBlock(providerName: string, url: string) {
  return `
    datasource ${providerName} {
      provider = "${providerName}"
      url      = "${url}"
    }
  `
}
