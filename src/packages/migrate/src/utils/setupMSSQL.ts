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

  const connectionPool = new mssql.ConnectionPool(connectionString)
  const connection = await connectionPool.connect()

  try {
    await connection.query(`
      CREATE DATABASE [tests-migrate-shadowdb]
      CREATE DATABASE [tests-migrate]
    `)
  } catch (e) {
    console.warn(e)
  }

  if (dirname !== '') {
    let schema = 'USE [tests-migrate]\n'
    schema += fs.readFileSync(path.join(dirname, 'setup.sql'), 'utf-8')
    await connection.query(schema)
  }

  void connection.close()
}

export async function tearDownMSSQL(options: SetupParams) {
  const { connectionString } = options
  const connectionPool = new mssql.ConnectionPool(connectionString)
  const connection = await connectionPool.connect()

  await connection.query(`
    DROP DATABASE IF EXISTS "tests-migrate-shadowdb";
    DROP DATABASE IF EXISTS "tests-migrate";
`)
  void connection.close()
}
