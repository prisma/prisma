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
  const schema = fs.readFileSync(path.join(dirname, 'setup.sql'), 'utf-8')

  const connectionPool = new mssql.ConnectionPool(connectionString)
  const connection = await connectionPool.connect()

  await connection.query(schema)
  void connection.close()
}
