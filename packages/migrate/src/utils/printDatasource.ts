import chalk from 'chalk'

import { getDbInfo } from '../utils/ensureDatabaseExists'

// Datasource "db": SQLite database "dev.db" at "file:./dev.db"
// Datasource "my_db": PostgreSQL database "tests-migrate", schema "public" at "localhost:5432"
// Datasource "my_db": MySQL database "tests-migrate" at "localhost:5432"
// Datasource "my_db" - SQL Server
export async function printDatasource(schemaPath: string): Promise<void> {
  const dbInfo = await getDbInfo(schemaPath)

  if (dbInfo.dbType) {
    if (dbInfo.dbType === 'PostgreSQL' && dbInfo.dbName === undefined) {
      dbInfo.dbName = 'postgres'
    }

    if (dbInfo.dbType === 'SQL Server') {
      console.info(chalk.dim(`Datasource "${dbInfo.name}" - SQL Server`))
    } else {
      console.info(
        chalk.dim(
          `Datasource "${dbInfo.name}": ${dbInfo.dbType} database "${dbInfo.dbName}"${
            dbInfo.schema ? `, schema "${dbInfo.schema}"` : ''
          } at "${dbInfo.dbLocation}"`,
        ),
      )
    }
  } else if (dbInfo.name) {
    console.info(chalk.dim(`Datasource "${dbInfo.name}"`))
  } else {
    // Nothing
  }
}
