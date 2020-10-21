import { getLatestTag } from '@prisma/fetch-engine'
import { getGenerator, IntrospectionEngine } from '@prisma/sdk'
import slugify from '@sindresorhus/slugify'
import fs from 'fs-jetpack'
import { FSJetpack } from 'fs-jetpack/types'
import * as Path from 'path'
import pkgup from 'pkg-up'
import hash from 'string-hash'
import VError, { MultiError } from 'verror'

process.setMaxListeners(200)

process.env.SKIP_GENERATE = 'true'

const pkgDir = pkgup.sync() || __dirname
const engine = new IntrospectionEngine()

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
  down?: string
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
export type Context = {
  /**
   * Jetpack instance bound to the integration test temporary directory.
   */
  fs: FSJetpack
  /**
   * The name of the current test being run.
   */
  scenarioName: string
  /**
   * The name of the current test being run, slugified.
   */
  scenarioSlug: string
  /**
   * The ID for the current scenario test being run.
   */
  id: string
  /**
   * Which step of setup we are on
   */
  step?: 'database' | 'scenario'
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
   * Create a query client connection to the database if its different from the main db.
   */
  clientConnect?: (ctx: Context) => MaybePromise<Client>
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
  /**
   * SQL to setup and select a database before running a test scenario.
   */
  up?: (ctx: Context) => string
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
  /**
   * After a test scenario is done, should its temporary directory be removed from disk?
   */
  cleanupTempDirs?: boolean
}

/**
 * Integration test keyword arguments
 */
export type Input<Client = any> = {
  database: Database<Client>
  scenarios: Scenario[]
  settings?: Settings
}

type ScenarioState<Client = any> = {
  scenario: Scenario
  ctx: Context
  database: Input<Client>['database']
  db: Client
  queryClient?: Client
  prisma: any
  input: Input<Client>
}

/**
 * Run introspection integration test
 */
export function introspectionIntegrationTest<Client>(input: Input<Client>) {
  const kind = 'introspection'

  const states: Record<string, ScenarioState<Client>> = {}

  beforeAll(() => {
    beforeAllScenarios(kind, input)
  })

  afterAll(async () => {
    await afterAllScenarios(kind, states)
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
    `${kind}: %s`,
    async (_, scenario) => {
      const { state, introspectionResult } = await setupScenario(
        kind,
        input,
        scenario,
      )
      states[scenario.name] = state

      expect(introspectionResult.datamodel).toMatchSnapshot(`datamodel`)
      expect(introspectionResult.warnings).toMatchSnapshot(`warnings`)

      await teardownScenario(state)
    },
    input.settings?.timeout ?? 30_000,
  )
}

/**
 * Run a runtime integration tests
 */
export function runtimeIntegrationTest<Client>(input: Input<Client>) {
  const kind = 'runtime'

  const states: Record<string, ScenarioState<Client>> = {}

  beforeAll(() => {
    beforeAllScenarios(kind, input)
  })

  afterAll(async () => {
    await afterAllScenarios(kind, states)
  })

  const engineVersionPromise = input.settings?.engineVersion
    ? input.settings.engineVersion
    : getLatestTag()

  it.concurrent.each(prepareTestScenarios(input.scenarios))(
    `${kind}: %s`,
    async (_, scenario) => {
      const engineVersion = await engineVersionPromise
      const { ctx, state, prismaSchemaPath } = await setupScenario(
        kind,
        input,
        scenario,
      )
      states[scenario.name] = state

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

      await teardownScenario(state)
    },
    input.settings?.timeout ?? 30_000,
  )
}

async function afterAllScenarios(
  kind: string,
  states: Record<string, ScenarioState>,
) {
  engine.stop()
  Object.entries(states).forEach(async ([_, state]) => {
    // props might be missing if test errors out before they are set.
    if (state.db && state.input.database.close) {
      await state.input.database.close(state.db)
    }
    if (state.input.settings?.cleanupTempDirs !== false) {
      fs.remove(getScenariosDir(state.input.database.name, kind))
    }
  })
}

function beforeAllScenarios(testKind: string, input: Input) {
  fs.remove(getScenariosDir(input.database.name, testKind))
}

/**
 * Setup the scenario test context and state and Prisma datamodel.
 */
async function setupScenario(kind: string, input: Input, scenario: Scenario) {
  const state: ScenarioState = {} as any
  const ctx: Context = {} as any
  ctx.fs = fs.cwd(getScenarioDir(input.database.name, kind, scenario.name))
  ctx.scenarioName = `${kind}: ${scenario.name}`
  ctx.scenarioSlug = slugify(ctx.scenarioName, { separator: '_' })
  ctx.id = `${ctx.scenarioSlug.slice(0, 7)}_${hash(ctx.scenarioSlug)}`
  state.input = input
  state.ctx = ctx
  state.scenario = scenario

  await ctx.fs.dirAsync('.')

  // Prepare database
  const databaseUpSQL = input.database.up?.(ctx) ?? ''
  const dbClient = await input.database.connect({ ...ctx, step: 'database' })
  await input.database.send(dbClient, databaseUpSQL)
  await input.database.close?.(dbClient)

  //Prepare scenario
  const scenarioUpSQL = scenario.up
  state.db = await input.database.connect({ ...ctx, step: 'scenario' })
  await input.database.send(state.db, scenarioUpSQL)

  const datasourceBlock =
    'raw' in input.database.datasource
      ? input.database.datasource.raw(ctx)
      : makeDatasourceBlock(
          input.database.datasource.provider ?? input.database.name,
          typeof input.database.datasource.url === 'function'
            ? input.database.datasource.url(ctx)
            : input.database.datasource.url,
        )
  let schemaBase
  if (input.database.name !== 'sqlserver') {
    schemaBase = `
        generator client {
          provider = "prisma-client-js"
          output   = "${ctx.fs.path()}"
        }

        ${datasourceBlock}
      `
  } else {
    schemaBase = `
    generator client {
      provider = "prisma-client-js"
      output   = "${ctx.fs.path()}"
      previewFeatures = ["microsoftSqlServer"]
    }

    ${datasourceBlock}
  `
  }

  const introspectionResult = await engine.introspect(schemaBase)
  const prismaSchemaPath = ctx.fs.path('schema.prisma')

  await fs.writeAsync(prismaSchemaPath, introspectionResult.datamodel)
  return {
    introspectionResult,
    state,
    ctx,
    prismaSchemaPath,
  }
}

async function teardownScenario(state: ScenarioState) {
  const errors: any[] = []

  // props might be missing if test errors out before they are set.
  if (state.db) {
    await Promise.resolve(
      state.scenario.down
        ? state.input.database.send(state.db, state.scenario.down)
        : undefined,
    )
      .catch(e => errors.push(e))
      .then(() => state.input.database.afterEach?.(state.db))
      .catch(e => errors.push(e))
      .then(() => state.prisma?.$disconnect())
      .catch(e => errors.push(e))
  }

  if (errors.length) {
    throw new VError(
      new MultiError(errors),
      'Got Errors while running scenario teardown',
    )
  }
}

/**
 * Convert test scenarios into something jest.each can consume
 */
function prepareTestScenarios(scenarios: Scenario[]): [string, Scenario][] {
  const onlys = scenarios.filter(scenario => scenario.only)

  if (onlys.length) {
    return onlys.map(scenario => [scenario.name, scenario])
  }

  return scenarios
    .filter(scenario => scenario.todo !== true)
    .map(scenario => [scenario.name, scenario])
}

/**
 * Get the temporary directory for the scenario
 */
function getScenarioDir(
  databaseName: string,
  testKind: string,
  scenarioName: string,
) {
  return Path.join(getScenariosDir(databaseName, testKind), scenarioName)
}

/**
 * Get the temporary directory for the scenarios
 */
function getScenariosDir(databaseName: string, testKind: string) {
  return Path.join(
    Path.dirname(pkgDir),
    'src',
    '__tests__',
    'tmp',
    `integration-test-${databaseName}-${testKind}`,
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
