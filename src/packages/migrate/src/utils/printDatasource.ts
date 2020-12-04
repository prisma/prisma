import { getDbInfo } from '../utils/ensureDatabaseExists'

export function printDatasource(schemaPath: string): void {
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
