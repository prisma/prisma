import { ProviderFlavor } from '../_matrix'
import { DatabaseRunnerQueries } from './DatabaseRunner'
import * as mssql from './mssql'
import * as mysql from './mysql'
import * as postgres from './postgres'
import { SetupParams } from './types'

type SetupConfig = {
  providerFlavor: ProviderFlavor
  setupParams: SetupParams
  createTableStmts: { [key in 'MySQL' | 'Postgres' | 'SQLServer']?: string }
  databaseRunnerQueries: DatabaseRunnerQueries
}

export async function setup(config: SetupConfig) {
  const { providerFlavor, setupParams, createTableStmts, databaseRunnerQueries } = config

  async function setupMySQL() {
    await mysql.runAndForget(setupParams, createTableStmts['MySQL']!)
    const databaseRunner = await mysql.DatabaseRunner.new(setupParams, databaseRunnerQueries)
    return databaseRunner
  }

  async function setupPostgres() {
    await postgres.runAndForget(setupParams, createTableStmts['Postgres']!)
    const databaseRunner = await postgres.DatabaseRunner.new(setupParams, databaseRunnerQueries)
    return databaseRunner
  }

  async function setupMSSQL() {
    await mssql.runAndForget(setupParams, createTableStmts['SQLServer']!)
    const databaseRunner = await mssql.DatabaseRunner.new(setupParams, databaseRunnerQueries)
    return databaseRunner
  }

  switch (providerFlavor) {
    case 'mysql':
      return await setupMySQL()
    case 'postgres':
    case 'cockroach':
      return await setupPostgres()
    case 'mssql':
      return await setupMSSQL()
    default:
      throw new Error(`Unsupported provider flavor ${providerFlavor}!`)
  }
}
