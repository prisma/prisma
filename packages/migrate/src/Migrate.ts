import { enginesVersion } from '@prisma/engines-version'
import { getGenerators, getGeneratorSuccessMessage, getSchemaPathSync } from '@prisma/internals'
import chalk from 'chalk'
import fs from 'fs'
import logUpdate from 'log-update'
import path from 'path'

import { MigrateEngine } from './MigrateEngine'
import type { EngineArgs, EngineResults } from './types'
import { NoSchemaFoundError } from './utils/errors'

const packageJson = eval(`require('../package.json')`)

export class Migrate {
  public engine: MigrateEngine
  private schemaPath?: string
  public migrationsDirectoryPath?: string
  constructor(schemaPath?: string, enabledPreviewFeatures?: string[]) {
    // schemaPath and migrationsDirectoryPath is optional for primitives
    // like migrate diff and db execute
    if (schemaPath) {
      this.schemaPath = this.getSchemaPath(schemaPath)
      this.migrationsDirectoryPath = path.join(path.dirname(this.schemaPath), 'migrations')
      this.engine = new MigrateEngine({
        projectDir: path.dirname(this.schemaPath),
        schemaPath: this.schemaPath,
        enabledPreviewFeatures,
      })
    } else {
      this.engine = new MigrateEngine({
        projectDir: process.cwd(),
        enabledPreviewFeatures,
      })
    }
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

  public getPrismaSchema(): string {
    if (!this.schemaPath) throw new Error('this.schemaPath is undefined')

    return fs.readFileSync(this.schemaPath, 'utf-8')
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

  public evaluateDataLoss(): Promise<EngineResults.EvaluateDataLossOutput> {
    if (!this.migrationsDirectoryPath) throw new Error('this.migrationsDirectoryPath is undefined')

    const schema = this.getPrismaSchema()

    return this.engine.evaluateDataLoss({
      migrationsDirectoryPath: this.migrationsDirectoryPath,
      prismaSchema: schema,
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

  public async tryToRunGenerate(): Promise<void> {
    if (!this.schemaPath) throw new Error('this.schemaPath is undefined')

    const message: string[] = []

    console.info() // empty line
    logUpdate(`Running generate... ${chalk.dim('(Use --skip-generate to skip the generators)')}`)

    const generators = await getGenerators({
      schemaPath: this.schemaPath,
      printDownloadProgress: true,
      version: enginesVersion,
      cliVersion: packageJson.version,
      dataProxy: false,
    })

    for (const generator of generators) {
      logUpdate(`Running generate... - ${generator.getPrettyName()}`)

      const before = Date.now()
      try {
        await generator.generate()
        const after = Date.now()
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
