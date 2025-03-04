import { isValidJsIdentifier } from '@prisma/internals'
import { introspectSql as migrateIntrospectSql, type IntrospectSqlError, type IntrospectSqlInput } from '@prisma/migrate'
import fs from 'node:fs/promises'
import { bold } from 'kleur/colors'
import path from 'node:path'

const SQL_DIR = 'sql'

export async function introspectSql(schemaPath: string) {
  const sqlFiles = await readTypedSqlFiles(schemaPath)
  const introspectionResult = await migrateIntrospectSql(schemaPath, sqlFiles)
  if (introspectionResult.ok) {
    return introspectionResult.queries
  }
  throw new Error(renderErrors(introspectionResult.errors))
}

export function sqlDirPath(schemaPath: string) {
  return path.join(path.dirname(schemaPath), SQL_DIR)
}

async function readTypedSqlFiles(schemaPath: string): Promise<IntrospectSqlInput[]> {
  const sqlPath = path.join(path.dirname(schemaPath), SQL_DIR)
  const files = await fs.readdir(sqlPath)
  const results: IntrospectSqlInput[] = []
  for (const fileName of files) {
    const { name, ext } = path.parse(fileName)
    if (ext !== '.sql') {
      continue
    }
    const absPath = path.join(sqlPath, fileName)
    if (!isValidJsIdentifier(name)) {
      throw new Error(`${absPath} can not be used as a typed sql query: name must be a valid JS identifier`)
    }
    if (name.startsWith('$')) {
      throw new Error(`${absPath} can not be used as a typed sql query: name must not start with $`)
    }
    const source = await fs.readFile(path.join(sqlPath, fileName), 'utf8')
    results.push({
      name,
      source,
      fileName: absPath,
    })
  }

  return results
}

function renderErrors(errors: IntrospectSqlError[]) {
  const lines: string[] = ['Errors while reading sql files:\n']
  for (const { fileName, message } of errors) {
    lines.push(`In ${bold(path.relative(process.cwd(), fileName))}:`)
    lines.push(message)
    lines.push('')
  }
  return lines.join('\n')
}
