import { getDbInfo } from '../utils/ensureDatabaseExists'
import chalk from 'chalk'

export async function printDatasource(schemaPath: string): Promise<void> {
  const dbInfo = await getDbInfo(schemaPath)
  console.info(
    chalk.dim(
      `Datasource "${dbInfo.name}": ${dbInfo.dbType} ${dbInfo.schemaWord} "${
        dbInfo.dbName
      }"${dbInfo.schema ? `, schema "${dbInfo.schema}"` : ''} at "${
        dbInfo.dbLocation
      }"`,
    ),
  )
}
