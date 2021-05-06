import fs from 'fs'
import path from 'path'
import mssql from 'mssql'

export type SetupParams = {
  connectionString: string
  dirname: string
}

export async function setupMSSQL(options: SetupParams): Promise<void> {
  const { connectionString } = options
  const { dirname } = options

  let schema = `
    IF NOT EXISTS(SELECT * FROM sys.databases WHERE name = 'tests-migrate')
    BEGIN
      CREATE DATABASE [tests-migrate]
    END
    IF NOT EXISTS(SELECT * FROM sys.databases WHERE name = 'tests-migrate-shadowdb')
    BEGIN
      CREATE DATABASE [tests-migrate-shadowdb]
    END

    USE [tests-migrate]
    `
  if (dirname !== '') {
    schema += fs.readFileSync(path.join(dirname, 'setup.sql'), 'utf-8')
  }

  const connectionPool = new mssql.ConnectionPool(connectionString)
  const connection = await connectionPool.connect()

  await connection.query(schema)
  void connection.close()
}

export async function tearDownMSSQL(options: SetupParams) {
  const { connectionString } = options
  const connectionPool = new mssql.ConnectionPool(connectionString)
  const connection = await connectionPool.connect()

  await connection.query(`
  DROP DATABASE IF EXISTS "tests-migrate";
`)
  void connection.close()
}
