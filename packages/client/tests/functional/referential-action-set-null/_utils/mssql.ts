import mssql from 'mssql'

export type SetupParams = {
  connectionString: string
}

export async function createTable(options: SetupParams, createTableStmt: string) {
  const { connectionString } = options
  const config = getMSSQLConfig(connectionString)
  const connectionPool = new mssql.ConnectionPool(config)
  const connection = await connectionPool.connect()

  try {
    await connection.query(createTableStmt)
  } finally {
    await connection.close()
  }
}

function getMSSQLConfig(url: string): mssql.config {
  const connectionUrl = new URL(url)
  return {
    user: connectionUrl.username,
    password: connectionUrl.password,
    server: connectionUrl.hostname,
    port: Number(connectionUrl.port),
    database: connectionUrl.pathname.substring(1),
    pool: {
      max: 1,
    },
    options: {
      enableArithAbort: false,
      trustServerCertificate: true, // change to true for local dev / self-signed certs
    },
  }
}
