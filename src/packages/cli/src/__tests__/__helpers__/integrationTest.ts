import { getGenerator, IntrospectionEngine } from '@prisma/sdk'
import * as fs from 'fs-jetpack'
import * as Path from 'path'
import pkgup from 'pkg-up'
import Database from 'sqlite-async'

const engineVersion = require('../../../package.json').prisma.version

process.env.SKIP_GENERATE = 'true'

const pkgDir = pkgup.sync() || __dirname
const engine = new IntrospectionEngine()

beforeAll(() => {
  fs.remove(getScenarioDir(''))
})

afterAll(() => {
  engine.stop()
  fs.remove(getScenarioDir(''))
})

type TestScenario = {
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

export function integrationTest(testScenarios: TestScenario[]) {
  /**
   * it.concurrent.each (https://jestjs.io/docs/en/api#testconcurrenteachtablename-fn-timeout)
   * does not seem to work. Snapshots keep getting errors. And each runs leads to different
   * snapshot errors. Might be related to https://github.com/facebook/jest/issues/2180 but we're
   * explicitly naming our snapshots here so...?
   */
  it.each(prepareTestScenarios(testScenarios))(
    `%s`,
    async (name, scenario) => {
      const tmpDirPath = getScenarioDir(name)
      const sqlitePath = Path.join(tmpDirPath, 'sqlite.db')
      const schemaPath = Path.join(tmpDirPath, 'schema.prisma')
      const connectionString = `file:${sqlitePath}`
      await fs.dirAsync(tmpDirPath)

      const db = await Database.open(sqlitePath)
      await db.exec(scenario.up)

      try {
        const schema = `
      generator client {
        provider = "prisma-client-js"
        output   = "${tmpDirPath}"
      }

      datasource sqlite {
        provider = "sqlite"
        url = "${connectionString}"
      }
    `
        const introspectionResult = await engine.introspect(schema)
        const introspectionSchema = introspectionResult.datamodel

        await generate(schemaPath, introspectionSchema)
        const prismaClientPath = Path.join(tmpDirPath, 'index.js')

        const { PrismaClient, prismaVersion } = await import(prismaClientPath)
        expect(prismaVersion.client).toMatch(/^2.+/)
        expect(prismaVersion.engine).toEqual(engineVersion)

        const prisma = new PrismaClient()
        await prisma.$connect()
        try {
          const result = await scenario.do(prisma)
          expect(result).toEqual(scenario.expect)
        } catch (err) {
          throw err
        } finally {
          await prisma.$disconnect()
        }

        expect(maskSchema(introspectionSchema)).toMatchSnapshot(`datamodel`)
        expect(introspectionResult.warnings).toMatchSnapshot(`warnings`)
      } catch (e) {
        throw e
      } finally {
        await db.close()
      }
    },
    10_000,
  )
}

function prepareTestScenarios(
  scenarios: TestScenario[],
): [string, TestScenario][] {
  const onlys = scenarios.filter((scenario) => scenario.only)

  if (onlys.length) {
    return onlys.map((scenario) => [scenario.name, scenario])
  }

  return scenarios
    .filter((scenario) => scenario.todo !== true)
    .map((scenario) => [scenario.name, scenario])
}

function getScenarioDir(name: string) {
  return Path.join(Path.dirname(pkgDir), 'tmp-sqlite', name)
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
