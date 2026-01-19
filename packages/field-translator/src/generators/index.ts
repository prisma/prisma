/**
 * Field transformation generators export
 */

// Import generators for the collection
import { mysqlGenerator } from './mysql.js'
import { postgresqlGenerator } from './postgresql.js'
import { sqliteGenerator } from './sqlite.js'

export { mysqlGenerator, MySQLTransformationGenerator } from './mysql.js'
export { postgresqlGenerator, PostgreSQLTransformationGenerator } from './postgresql.js'
export { sqliteGenerator, SQLiteTransformationGenerator } from './sqlite.js'

// Re-export all generators as a convenient collection
export const generators = {
  sqlite: sqliteGenerator,
  postgresql: postgresqlGenerator,
  mysql: mysqlGenerator,
} as const
