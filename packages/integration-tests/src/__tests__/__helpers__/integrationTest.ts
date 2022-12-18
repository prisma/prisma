import { MigrateEngine } from '@prisma/migrate'
import slugify from '@sindresorhus/slugify'
import fs from 'fs-jetpack'
import type { FSJetpack } from 'fs-jetpack/types'
import path from 'path'
import hash from 'string-hash'
import VError, { MultiError } from 'verror'

import { getTestClient } from '../../../../client/src/utils/getTestClient'

process.setMaxListeners(200)

process.env.PRISMA_SKIP_POSTINSTALL_GENERATE = 'true'

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
   * Run logic before each scenario. Typically used to run scenario SQL setup against the database.
   */
  beforeEach: (db: Client, sqlScenario: string, ctx: Context) => MaybePromise<any>
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
  /**
   * After a test scenario is done, should its temporary directory be removed from disk?
   */
  cleanupTempDirs?: boolean
}

/**
 * A list of available preview features on the Prisma client.
 */
type PreviewFeature = ''

/**
 * Settings to add properties on the Prisma client.
 */
type PrismaClientSettings = {
  /**
   *  Supply the enabled preview features for the Prisma client.
   */
  previewFeatures?: PreviewFeature[]
}

/**
 * Integration test keyword arguments
 */
export type Input<Client = any> = {
  database: Database<Client>
  scenarios: Scenario[]
  settings?: Settings
  prismaClientSettings?: PrismaClientSettings
}

type ScenarioState<Client = any> = {
  scenario: Scenario
  ctx: Context
  database: Input<Client>['database']
  db: Client
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

  afterAll(() => {
    afterAllScenarios(kind, states)
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
  it.each(filterTestScenarios(input.scenarios))(
    `${kind}: %s`,
    async (_, scenario) => {
      const { state, introspectionResult } = await setupScenario(kind, input, scenario)
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

  afterAll(() => {
    afterAllScenarios(kind, states)
  })

  it.each(filterTestScenarios(input.scenarios))(
    `${kind}: %s`,
    async (_, scenario) => {
      const { ctx, state } = await setupScenario(kind, input, scenario)
      states[scenario.name] = state

      const PrismaClient = await getTestClient(ctx.fs.cwd())

      state.prisma = new PrismaClient()
      await state.prisma.$connect()

      const result = await scenario.do(state.prisma)
      expect(result).toEqual(scenario.expect)

      await teardownScenario(state)
    },
    input.settings?.timeout ?? 30_000,
  )
}

function afterAllScenarios(kind: string, states: Record<string, ScenarioState>) {
  Object.values(states).forEach(async (state) => {
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
  const dir = getScenarioDir(input.database.name, kind, scenario.name)
  ctx.fs = fs.cwd(dir)
  ctx.scenarioName = `${kind}: ${scenario.name}`
  ctx.scenarioSlug = slugify(ctx.scenarioName, { separator: '_' })
  ctx.id = `${ctx.scenarioSlug.slice(0, 7)}_${hash(ctx.scenarioSlug)}`
  state.input = input
  state.ctx = ctx
  state.scenario = scenario

  await ctx.fs.dirAsync('.')

  state.db = await input.database.connect(ctx)
  await input.database.beforeEach(state.db, scenario.up, ctx)

  const datasourceBlock =
    'raw' in input.database.datasource
      ? input.database.datasource.raw(ctx)
      : makeDatasourceBlock(
          input.database.datasource.provider ?? input.database.name,
          typeof input.database.datasource.url === 'function'
            ? input.database.datasource.url(ctx)
            : input.database.datasource.url,
        )

  const schemaBase = `
    generator client {
      provider = "prisma-client-js"
      output   = "${ctx.fs.path()}"
      ${renderPreviewFeatures(input.prismaClientSettings?.previewFeatures)}
    }

    ${datasourceBlock}
  `

  const engine = new MigrateEngine({
    projectDir: process.cwd(),
  })
  const introspectionResult = await engine.introspect({ schema: schemaBase })
  engine.stop()

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
    await Promise.resolve(state.input.database.afterEach?.(state.db))
      .catch((e) => errors.push(e))
      .then(() => state.prisma?.$disconnect())
      .catch((e) => errors.push(e))
  }

  if (errors.length) {
    throw new VError(new MultiError(errors), 'Got Errors while running scenario teardown')
  }
}

/**
 * Convert test scenarios into something jest.each can consume
 */
function filterTestScenarios(scenarios: Scenario[]): [string, Scenario][] {
  const onlys = scenarios.filter((scenario) => scenario.only)

  if (onlys.length) {
    return onlys.map((scenario) => [scenario.name, scenario])
  }

  return scenarios.filter((scenario) => scenario.todo !== true).map((scenario) => [scenario.name, scenario])
}

/**
 * Get the temporary directory for the scenario
 */
function getScenarioDir(databaseName: string, testKind: string, scenarioName: string) {
  return path.join(getScenariosDir(databaseName, testKind), slugify(scenarioName))
}

/**
 * Get the temporary directory for the scenarios
 */
function getScenariosDir(databaseName: string, testKind: string) {
  // use tmp dir instead, as that often times is ramdisk
  return path.join('/tmp/prisma-tests', `integration-test-${databaseName}-${testKind}`)
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

/**
 * Create Prisma schema enabled features array of strings.
 */
function renderPreviewFeatures(featureMatrix: PreviewFeature[] | undefined) {
  if (featureMatrix) {
    return `previewFeatures = [${featureMatrix.map((feature) => `"` + feature + `"`)}]`
  }
  return ''
}
