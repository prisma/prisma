import { getGenerator, IntrospectionEngine } from '@prisma/sdk'
import fs from 'fs-jetpack'
import { FSJetpack } from 'fs-jetpack/types'
import * as Path from 'path'
import pkgup from 'pkg-up'

const engineVersion = require('../../../package.json').prisma.version

process.env.SKIP_GENERATE = 'true'

const pkgDir = pkgup.sync() || __dirname
const engine = new IntrospectionEngine()

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
  up: string
  down: string
  do: (client: any) => Promise<any>
  expect: any
}

type Context = {
  fs: FSJetpack
}

type SideEffector<Args extends Array<any>> = (
  ...args: Args
) => Promise<any> | any

type Input = {
  database: {
    name: string
    open?: SideEffector<[ctx: Context]>
    up: SideEffector<[db: any, sql: string]>
    close?: SideEffector<[db: any, ctx: Context]>
    datasourceBlock: (ctx: Context) => string
  }
  setup?: {
    database?: SideEffector<[ctx: Context]>
  }
  scenarios: Scenario[]
}

export function integrationTest(input: Input) {
  type ScenarioState = {
    ctx: Context
    database: Input['database']
    db: any
    prisma: any
  }

  const state: ScenarioState = {} as any

  beforeAll(() => {
    fs.remove(getScenarioDir(input.database.name, ''))
  })

  afterAll(() => {
    engine.stop()
    fs.remove(getScenarioDir(input.database.name, ''))
  })

  afterEach(async () => {
    // props might be missing if test errors out before they are set.
    await input.database.close?.(state.db, state.ctx)
    await state.prisma?.$disconnect()
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

      await ctx.fs.dirAsync('.')

      const db = await input.database?.open?.(ctx)

      state.db = db

      await input.database?.up(db, scenario.up)

      const schema = `
        generator client {
          provider = "prisma-client-js"
          output   = "${ctx.fs.path()}"
        }

        ${input.database.datasourceBlock(ctx)}
      `

      const introspectionResult = await engine.introspect(schema)
      const introspectionSchema = introspectionResult.datamodel

      await generate(ctx.fs.path('schema.prisma'), introspectionSchema)

      const { PrismaClient, prismaVersion } = await import(
        ctx.fs.path('index.js')
      )
      expect(prismaVersion.client).toMatch(/^2.+/)
      expect(prismaVersion.engine).toEqual(engineVersion)

      state.prisma = new PrismaClient()
      await state.prisma.$connect()

      const result = await scenario.do(state.prisma)

      expect(result).toEqual(scenario.expect)
      expect(maskSchema(introspectionSchema)).toMatchSnapshot(`datamodel`)
      expect(introspectionResult.warnings).toMatchSnapshot(`warnings`)
    },
    10_000,
  )
}

function prepareTestScenarios(scenarios: Scenario[]): [string, Scenario][] {
  const onlys = scenarios.filter((scenario) => scenario.only)

  if (onlys.length) {
    return onlys.map((scenario) => [scenario.name, scenario])
  }

  return scenarios
    .filter((scenario) => scenario.todo !== true)
    .map((scenario) => [scenario.name, scenario])
}

function getScenarioDir(databaseName: string, scenarioName: string) {
  return Path.join(Path.dirname(pkgDir), databaseName, scenarioName)
}

async function generate(schemaPath: string, datamodel: string) {
  await fs.writeAsync(schemaPath, datamodel)

  const generator = await getGenerator({
    schemaPath,
    printDownloadProgress: false,
    baseDir: Path.dirname(schemaPath),
    version: engineVersion,
  })

  await generator.generate()

  generator.stop()
}

export function maskSchema(schema: string): string {
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
