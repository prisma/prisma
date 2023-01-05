import chalk from 'chalk'

import { getDatasourceInfo } from '../utils/ensureDatabaseExists'

// Datasource "db": SQLite database "dev.db" at "file:./dev.db"
// Datasource "my_db": PostgreSQL database "tests-migrate", schema "public" at "localhost:5432"
// Datasource "my_db": MySQL database "tests-migrate" at "localhost:5432"
// Datasource "my_db" - SQL Server
export async function printDatasource({ schemaPath }: { schemaPath: string }): Promise<void> {
  const datasourceInfo = await getDatasourceInfo(schemaPath)

  if (datasourceInfo.dbType) {
    if (datasourceInfo.dbType === 'PostgreSQL' && datasourceInfo.dbName === undefined) {
      datasourceInfo.dbName = 'postgres'
    }

    if (datasourceInfo.dbType === 'SQL Server') {
      console.info(chalk.dim(`Datasource "${datasourceInfo.name}" - SQL Server`))
    } else {
      console.info(
        chalk.dim(
          `Datasource "${datasourceInfo.name}": ${datasourceInfo.dbType} database "${datasourceInfo.dbName}"${
            datasourceInfo.schema ? `, schema "${datasourceInfo.schema}"` : ''
          } at "${datasourceInfo.dbLocation}"`,
        ),
      )
    }
  } else if (datasourceInfo.name) {
    console.info(chalk.dim(`Datasource "${datasourceInfo.name}"`))
  } else {
    // Nothing
  }
}
