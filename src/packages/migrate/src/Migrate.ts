import {
  getSchemaPathSync,
  getGenerators,
  uriToCredentials,
  getConfig,
} from '@prisma/sdk'
import chalk from 'chalk'
import Debug from '@prisma/debug'
import fs from 'fs'
import logUpdate from 'log-update'
import path from 'path'
import { MigrateEngine } from './MigrateEngine'
import { EngineResults, EngineArgs } from './types'
import { formatms } from './utils/formatms'
import {
  getDbinfoFromCredentials,
  getDbLocation,
} from './utils/ensureDatabaseExists'
import { enginesVersion } from '@prisma/engines-version'
import { NoSchemaFoundError } from './utils/errors'

const debug = Debug('migrate')
const packageJson = eval(`require('../package.json')`) // tslint:disable-line

export class Migrate {
  get devMigrationsDir(): string {
    return path.join(path.dirname(this.schemaPath), 'migrations/dev')
  }
  public engine: MigrateEngine
  private schemaPath: string
  public migrationsDirectoryPath: string
  constructor(schemaPath?: string, enabledPreviewFeatures?: string[]) {
    this.schemaPath = this.getSchemaPath(schemaPath)
    this.migrationsDirectoryPath = path.join(
      path.dirname(this.schemaPath),
      'migrations',
    )
    this.engine = new MigrateEngine({
      projectDir: path.dirname(this.schemaPath),
      schemaPath: this.schemaPath,
      enabledPreviewFeatures,
    })
  }

  public stop(): void {
    this.engine.stop()
  }

  public getSchemaPath(schemaPathFromOptions?): string {
    const schemaPath = getSchemaPathSync(schemaPathFromOptions)

    if (!schemaPath) {
      throw new NoSchemaFoundError()
    }

    return schemaPath
  }

  public getDatamodel(): string {
    return fs.readFileSync(this.schemaPath, 'utf-8')
  }

  public reset(): Promise<void> {
    return this.engine.reset()
  }

  public createMigration(
    params: EngineArgs.CreateMigrationInput,
  ): Promise<EngineResults.CreateMigrationOutput> {
    return this.engine.createMigration(params)
  }

  public diagnoseMigrationHistory({
    optInToShadowDatabase,
  }: {
    optInToShadowDatabase: boolean
  }): Promise<EngineResults.DiagnoseMigrationHistoryOutput> {
    return this.engine.diagnoseMigrationHistory({
      migrationsDirectoryPath: this.migrationsDirectoryPath,
      optInToShadowDatabase,
    })
  }

  public async getDbInfo(): Promise<{
    schemaWord: string
    dbType: string
    dbName: string
    dbLocation: string
  }> {
    const datamodel = this.getDatamodel()
    const config = await getConfig({ datamodel })
    const activeDatasource = config.datasources[0]
    const credentials = uriToCredentials(activeDatasource.url.value)
    const dbLocation = getDbLocation(credentials)
    return {
      ...getDbinfoFromCredentials(credentials),
      dbLocation,
    }
  }

  public listMigrationDirectories(): Promise<EngineResults.ListMigrationDirectoriesOutput> {
    return this.engine.listMigrationDirectories({
      migrationsDirectoryPath: this.migrationsDirectoryPath,
    })
  }

  public async markMigrationApplied({
    migrationId,
  }: {
    migrationId: string
  }): Promise<void> {
    return await this.engine.markMigrationApplied({
      migrationsDirectoryPath: this.migrationsDirectoryPath,
      migrationName: migrationId,
    })
  }

  public markMigrationRolledBack({
    migrationId,
  }: {
    migrationId: string
  }): Promise<void> {
    return this.engine.markMigrationRolledBack({
      migrationName: migrationId,
    })
  }

  public applyScript({ script }: { script: string }): Promise<void> {
    return this.engine.applyScript({ script })
  }

  public applyMigrations(): Promise<EngineResults.ApplyMigrationsOutput> {
    return this.engine.applyMigrations({
      migrationsDirectoryPath: this.migrationsDirectoryPath,
    })
  }

  public evaluateDataLoss(): Promise<EngineResults.EvaluateDataLossOutput> {
    const datamodel = this.getDatamodel()

    return this.engine.evaluateDataLoss({
      migrationsDirectoryPath: this.migrationsDirectoryPath,
      prismaSchema: datamodel,
    })
  }

  public async push({
    force = false,
  }: {
    force?: boolean
  }): Promise<EngineResults.SchemaPush> {
    const datamodel = this.getDatamodel()

    const {
      warnings,
      unexecutable,
      executedSteps,
    } = await this.engine.schemaPush({
      force,
      schema: datamodel,
    })

    return {
      executedSteps,
      warnings,
      unexecutable,
    }
  }

  public async tryToRunGenerate(): Promise<void> {
    const message: string[] = []

    console.info() // empty line
    logUpdate(
      `Running generate... ${chalk.dim(
        '(Use --skip-generate to skip the generators)',
      )}`,
    )

    const generators = await getGenerators({
      schemaPath: this.schemaPath,
      printDownloadProgress: false,
      version: enginesVersion,
      cliVersion: packageJson.version,
    })

    for (const generator of generators) {
      const toStr = generator.options!.generator.output!
        ? chalk.dim(
            ` to .${path.sep}${path.relative(
              process.cwd(),
              generator.options!.generator.output,
            )}`,
          )
        : ''
      const name = generator.manifest
        ? generator.manifest.prettyName
        : generator.options!.generator.provider

      logUpdate(`Running generate... - ${name}`)

      const before = Date.now()
      try {
        await generator.generate()
        const after = Date.now()
        const version = generator.manifest?.version
        message.push(
          `✔ Generated ${chalk.bold(name!)}${
            version ? ` (${version})` : ''
          }${toStr} in ${formatms(after - before)}`,
        )
        generator.stop()
      } catch (err) {
        message.push(`${err.message}`)
        generator.stop()
      }
    }

    logUpdate(message.join('\n'))
  }
}
