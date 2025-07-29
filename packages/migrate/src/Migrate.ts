import { defaultRegistry } from '@prisma/client-generator-registry'
import type { ErrorCapturingSqlDriverAdapterFactory } from '@prisma/driver-adapter-utils'
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

import type { SchemaEngine } from './SchemaEngine'
import { SchemaEngineCLI } from './SchemaEngineCLI'
import { SchemaEngineWasm } from './SchemaEngineWasm'
import type { EngineArgs, EngineResults } from './types'
import { createMigration, writeMigrationLockfile, writeMigrationScript } from './utils/createMigration'
import { DatasourceInfo } from './utils/ensureDatabaseExists'
import { listMigrations } from './utils/listMigrations'
import { warnDatasourceDriverAdapter } from './utils/warnDatasourceDriverAdapter'

interface MigrateSetupInput {
  adapter?: ErrorCapturingSqlDriverAdapterFactory
  migrationsDirPath?: string
  enabledPreviewFeatures?: string[]
  schemaContext?: SchemaContext
  schemaFilter?: MigrateTypes.SchemaFilter
  shadowDbInitScript?: string
}

interface MigrateOptions {
  engine: SchemaEngine
  schemaContext?: SchemaContext
  migrationsDirPath?: string
  schemaFilter?: MigrateTypes.SchemaFilter
  shadowDbInitScript?: string
}

export class Migrate {
  public readonly engine: SchemaEngine
  private schemaContext?: SchemaContext
  private schemaFilter: MigrateTypes.SchemaFilter
  private shadowDbInitScript: string
  public migrationsDirectoryPath?: string

  private constructor({ schemaContext, migrationsDirPath, engine, schemaFilter, shadowDbInitScript }: MigrateOptions) {
    this.engine = engine

    // schemaPath and migrationsDirectoryPath are optional for primitives
    // like migrate diff and db execute
    this.schemaContext = schemaContext
    this.migrationsDirectoryPath = migrationsDirPath
    this.schemaFilter = schemaFilter ?? { externalTables: [], externalEnums: [] }
    this.shadowDbInitScript = shadowDbInitScript ?? ''
  }

  static async setup({ adapter, schemaContext, ...rest }: MigrateSetupInput): Promise<Migrate> {
    const engine = await (async () => {
      if (adapter) {
        return await SchemaEngineWasm.setup({ adapter, schemaContext, ...rest })
      } else {
        return await SchemaEngineCLI.setup({ schemaContext, ...rest })
      }
    })()

    warnDatasourceDriverAdapter(schemaContext, adapter)

    return new Migrate({ engine, schemaContext, ...rest })
  }

  public async stop(): Promise<void> {
    await this.engine.stop()
  }

  public getPrismaSchema(): MigrateTypes.SchemasContainer {
    if (!this.schemaContext) throw new Error('this.schemaContext is undefined')

    return toSchemasContainer(this.schemaContext.schemaFiles)
  }

  public reset(): Promise<void> {
    return this.engine.reset({
      filter: this.schemaFilter,
    })
  }

  public async createMigration(
    params: Omit<EngineArgs.CreateMigrationInput, 'migrationsList' | 'filters'>,
  ): Promise<{ generatedMigrationName: string | undefined }> {
    if (!this.migrationsDirectoryPath) throw new Error('this.migrationsDirectoryPath is undefined')

    const migrationsList = await listMigrations(this.migrationsDirectoryPath, this.shadowDbInitScript)
    const { connectorType, generatedMigrationName, extension, migrationScript } = await this.engine.createMigration({
      ...params,
      migrationsList,
      filters: this.schemaFilter,
    })
    const { baseDir, lockfile } = migrationsList

    if (migrationScript === null) {
      return {
        generatedMigrationName: undefined,
      }
    }

    const directoryPath = await createMigration({
      baseDir,
      generatedMigrationName,
    }).catch((e: Error) => {
      throw new Error(`Failed to create a new migration directory: ${e.message}`)
    })

    await writeMigrationScript({
      baseDir,
      extension,
      migrationName: generatedMigrationName,
      script: migrationScript,
    }).catch((e: Error) => {
      throw new Error(`Failed to write migration script to ${directoryPath}: ${e.message}`)
    })

    await writeMigrationLockfile({
      baseDir,
      connectorType,
      lockfile,
    }).catch((e: Error) => {
      throw new Error(`Failed to write the migration lock file to ${baseDir}: ${e.message}`)
    })

    return {
      generatedMigrationName,
    }
  }

  public async diagnoseMigrationHistory({
    optInToShadowDatabase,
  }: {
    optInToShadowDatabase: boolean
  }): Promise<EngineResults.DiagnoseMigrationHistoryOutput> {
    if (!this.migrationsDirectoryPath) throw new Error('this.migrationsDirectoryPath is undefined')

    const migrationsList = await listMigrations(this.migrationsDirectoryPath, this.shadowDbInitScript)

    return this.engine.diagnoseMigrationHistory({
      migrationsList,
      optInToShadowDatabase,
      filters: this.schemaFilter,
    })
  }

  public async listMigrationDirectories(): Promise<EngineResults.ListMigrationDirectoriesOutput> {
    if (!this.migrationsDirectoryPath) throw new Error('this.migrationsDirectoryPath is undefined')

    const migrationsList = await listMigrations(this.migrationsDirectoryPath, this.shadowDbInitScript)

    return {
      migrations: migrationsList.migrationDirectories.map((dir) => dir.path),
    }
  }

  public async devDiagnostic(): Promise<EngineResults.DevDiagnosticOutput> {
    if (!this.migrationsDirectoryPath) throw new Error('this.migrationsDirectoryPath is undefined')

    const migrationsList = await listMigrations(this.migrationsDirectoryPath, this.shadowDbInitScript)

    return this.engine.devDiagnostic({
      migrationsList,
      filters: this.schemaFilter,
    })
  }

  public async markMigrationApplied({ migrationId }: { migrationId: string }): Promise<void> {
    if (!this.migrationsDirectoryPath) throw new Error('this.migrationsDirectoryPath is undefined')

    const migrationsList = await listMigrations(this.migrationsDirectoryPath, this.shadowDbInitScript)

    return await this.engine.markMigrationApplied({
      migrationsList,
      migrationName: migrationId,
    })
  }

  public markMigrationRolledBack({ migrationId }: { migrationId: string }): Promise<void> {
    return this.engine.markMigrationRolledBack({
      migrationName: migrationId,
    })
  }

  public async applyMigrations(): Promise<EngineResults.ApplyMigrationsOutput> {
    if (!this.migrationsDirectoryPath) throw new Error('this.migrationsDirectoryPath is undefined')

    const migrationsList = await listMigrations(this.migrationsDirectoryPath, this.shadowDbInitScript)

    return this.engine.applyMigrations({
      migrationsList,
      filters: this.schemaFilter,
    })
  }

  public async evaluateDataLoss(): Promise<EngineResults.EvaluateDataLossOutput> {
    if (!this.migrationsDirectoryPath) throw new Error('this.migrationsDirectoryPath is undefined')

    const migrationsList = await listMigrations(this.migrationsDirectoryPath, this.shadowDbInitScript)
    const schema = this.getPrismaSchema()

    return this.engine.evaluateDataLoss({
      migrationsList,
      schema: schema,
      filters: this.schemaFilter,
    })
  }

  public async push({ force = false }: { force?: boolean }): Promise<EngineResults.SchemaPush> {
    const schema = this.getPrismaSchema()

    const { warnings, unexecutable, executedSteps } = await this.engine.schemaPush({
      force,
      schema,
      filters: this.schemaFilter,
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
      schemaContext: this.schemaContext,
      printDownloadProgress: true,
      version: enginesVersion,
      noEngine: skipEngines,
      registry: defaultRegistry.toInternal(),
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
