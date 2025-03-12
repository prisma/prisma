import { enginesVersion } from '@prisma/engines-version'
import {
  getGenerators,
  getGeneratorSuccessMessage,
  isPrismaPostgres,
  MigrateTypes,
  SchemaContext,
  toSchemasContainer,
} from '@prisma/internals'
import { dim } from 'kleur/colors'
import logUpdate from 'log-update'
import path from 'path'

import { SchemaEngine } from './SchemaEngine'
import type { EngineArgs, EngineResults } from './types'
import { DatasourceInfo } from './utils/ensureDatabaseExists'

// TODO: `eval` is used so that the `version` field in package.json (resolved at compile-time) doesn't yield `0.0.0`.
// We should mark this bit as `external` during the build, so that we can get rid of `eval` and still import the JSON we need at runtime.
const packageJson = eval(`require('../package.json')`)

export class Migrate {
  public engine: SchemaEngine
  private schemaContext?: SchemaContext
  public migrationsDirectoryPath?: string

  constructor(schemaContext?: SchemaContext, enabledPreviewFeatures?: string[]) {
    // schemaPath and migrationsDirectoryPath is optional for primitives
    // like migrate diff and db execute
    if (schemaContext) {
      this.schemaContext = schemaContext
      this.migrationsDirectoryPath = path.join(path.dirname(schemaContext.schemaPath), 'migrations') // TODO: refactor in scope of ORM-663
      this.engine = new SchemaEngine({ schemaContext, enabledPreviewFeatures })
    } else {
      this.engine = new SchemaEngine({
        enabledPreviewFeatures,
      })
    }
  }

  public stop(): void {
    this.engine.stop()
  }

  public getPrismaSchema(): MigrateTypes.SchemasContainer {
    if (!this.schemaContext) throw new Error('this.schemaContext is undefined')

    return toSchemasContainer(this.schemaContext.schemaFiles)
  }

  public reset(): Promise<void> {
    return this.engine.reset()
  }

  public createMigration(params: EngineArgs.CreateMigrationInput): Promise<EngineResults.CreateMigrationOutput> {
    return this.engine.createMigration(params)
  }

  public diagnoseMigrationHistory({
    optInToShadowDatabase,
  }: {
    optInToShadowDatabase: boolean
  }): Promise<EngineResults.DiagnoseMigrationHistoryOutput> {
    if (!this.migrationsDirectoryPath) throw new Error('this.migrationsDirectoryPath is undefined')

    return this.engine.diagnoseMigrationHistory({
      migrationsDirectoryPath: this.migrationsDirectoryPath,
      optInToShadowDatabase,
    })
  }

  public listMigrationDirectories(): Promise<EngineResults.ListMigrationDirectoriesOutput> {
    if (!this.migrationsDirectoryPath) throw new Error('this.migrationsDirectoryPath is undefined')

    return this.engine.listMigrationDirectories({
      migrationsDirectoryPath: this.migrationsDirectoryPath,
    })
  }

  public devDiagnostic(): Promise<EngineResults.DevDiagnosticOutput> {
    if (!this.migrationsDirectoryPath) throw new Error('this.migrationsDirectoryPath is undefined')

    return this.engine.devDiagnostic({
      migrationsDirectoryPath: this.migrationsDirectoryPath,
    })
  }

  public async markMigrationApplied({ migrationId }: { migrationId: string }): Promise<void> {
    if (!this.migrationsDirectoryPath) throw new Error('this.migrationsDirectoryPath is undefined')

    return await this.engine.markMigrationApplied({
      migrationsDirectoryPath: this.migrationsDirectoryPath,
      migrationName: migrationId,
    })
  }

  public markMigrationRolledBack({ migrationId }: { migrationId: string }): Promise<void> {
    return this.engine.markMigrationRolledBack({
      migrationName: migrationId,
    })
  }

  public applyMigrations(): Promise<EngineResults.ApplyMigrationsOutput> {
    if (!this.migrationsDirectoryPath) throw new Error('this.migrationsDirectoryPath is undefined')

    return this.engine.applyMigrations({
      migrationsDirectoryPath: this.migrationsDirectoryPath,
    })
  }

  public async evaluateDataLoss(): Promise<EngineResults.EvaluateDataLossOutput> {
    if (!this.migrationsDirectoryPath) throw new Error('this.migrationsDirectoryPath is undefined')

    return this.engine.evaluateDataLoss({
      migrationsDirectoryPath: this.migrationsDirectoryPath,
      schema: this.getPrismaSchema(),
    })
  }

  public async push({ force = false }: { force?: boolean }): Promise<EngineResults.SchemaPush> {
    const schema = this.getPrismaSchema()

    const { warnings, unexecutable, executedSteps } = await this.engine.schemaPush({
      force,
      schema,
    })

    return {
      executedSteps,
      warnings,
      unexecutable,
    }
  }

  public async tryToRunGenerate(datasourceInfo: DatasourceInfo): Promise<void> {
    if (!this.schemaContext) throw new Error('this.schemaContext is undefined')

    // Auto-append the `--no-engine` flag to the `prisma generate` command when a Prisma Postgres URL is used.
    const skipEngines = isPrismaPostgres(datasourceInfo.url)

    const message: string[] = []

    process.stdout.write('\n') // empty line
    logUpdate(`Running generate... ${dim('(Use --skip-generate to skip the generators)')}`)

    const generators = await getGenerators({
      schemaPath: this.schemaContext.schemaPath, // TODO: refactor getGenerators to not rely on schema path!
      printDownloadProgress: true,
      version: enginesVersion,
      cliVersion: packageJson.version,
      noEngine: skipEngines,
    })

    for (const generator of generators) {
      logUpdate(`Running generate... - ${generator.getPrettyName()}`)

      const before = Math.round(performance.now())
      try {
        await generator.generate()
        const after = Math.round(performance.now())
        message.push(getGeneratorSuccessMessage(generator, after - before))
        generator.stop()
      } catch (e: any) {
        message.push(`${e.message}`)
        generator.stop()
      }
    }

    logUpdate(message.join('\n'))
  }
}
