/**
 * Field transformation generators export
 */

export { SQLiteTransformationGenerator, sqliteGenerator } from './sqlite.js'
export { PostgreSQLTransformationGenerator, postgresqlGenerator } from './postgresql.js'
export { MySQLTransformationGenerator, mysqlGenerator } from './mysql.js'

// Import generators for the collection
import { sqliteGenerator } from './sqlite.js'
import { postgresqlGenerator } from './postgresql.js'
import { mysqlGenerator } from './mysql.js'

// Re-export all generators as a convenient collection
export const generators = {
  sqlite: sqliteGenerator,
  postgresql: postgresqlGenerator,
  mysql: mysqlGenerator
} as const