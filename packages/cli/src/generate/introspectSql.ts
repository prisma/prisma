import { introspectSql as migrateIntrospectSql } from '@prisma/migrate'
import fs from 'fs/promises'
import isIdentifier from 'is-identifier'
import path from 'path'

const SQL_DIR = 'sql'

type TypedSQLInput = {
  name: string
  source: string
}

export async function introspectSql(schemaPath: string) {
  const sqlFiles = await readTypedSqlFiles(schemaPath)
  return migrateIntrospectSql(schemaPath, sqlFiles)
}

async function readTypedSqlFiles(schemaPath: string): Promise<TypedSQLInput[]> {
  const sqlPath = path.join(path.dirname(schemaPath), SQL_DIR)
  const files = await fs.readdir(sqlPath)
  const results: TypedSQLInput[] = []
  for (const fileName of files) {
    const { name, ext } = path.parse(fileName)
    if (ext !== '.sql') {
      continue
    }
    const absPath = path.join(sqlPath, fileName)
    if (!isIdentifier(name)) {
      throw new Error(`${absPath} can not be used as a typed sql query: name must be a valid JS identifier`)
    }
    if (name.startsWith('$')) {
      throw new Error(`${absPath} can not be used as a typed sql query: name must not start with $`)
    }
    const source = await fs.readFile(path.join(sqlPath, fileName), 'utf8')
    results.push({
      name,
      source,
    })
  }

  return results
}
