import React, { useState } from 'react'
import { Color, Box } from 'ink'
import BorderBox from '../components/BorderBox'
import chalk from 'chalk'
import { Link } from '../components/Link'
import { TextInput } from '../components/inputs/TextInput'
import { useInitState } from '../components/InitState'
import { prettyDb } from '../utils/print'
import { DatabaseType } from 'prisma-datamodel'
import { useConnector } from '../components/useConnector'

// We can't use this screen yet, as we don't have SQLite introspection yet
const Step4SelectDatabase: React.FC = () => {
  const [state, { setState }] = useInitState()

  const { schemas } = useConnector()

  if (!schemas) {
    throw new Error(`Schemas are missing in select database view`)
  }
  if (!state.dbCredentials) {
    throw new Error('Missing credentials in select database view')
  }
  const { dbCredentials } = state
  const db = prettyDb(dbCredentials.type)
  const schemaWord = dbCredentials.type === DatabaseType.postgres ? 'schema' : 'database'

  const emptySchemas = schemas.filter(s => s.countOfTables === 0)
  const nonEmptySchemas = schemas.filter(s => s.countOfTables > 0)

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" marginLeft={2}>
        <Color bold>
          Select a {db} {schemaWord}.
        </Color>
        {state.useStarterKit ? (
          <Color dim>
            Found {emptySchemas.length} empty {schemaWord}s
          </Color>
        ) : (
          <Color dim>
            Found {emptySchemas.length} empty {schemaWord}s and {nonEmptySchemas.length} non-empty {db} {schemaWord}s
          </Color>
        )}
      </Box>
      {emptySchemas.length > 0 && (
        <BorderBox flexDirection="column" title={chalk.bold(`Empty ${schemaWord}s`)} marginTop={1}>
          {emptySchemas.map((schema, index) => (
            <Link
              label={schema.name}
              state={{ dbCredentials: { [schemaWord]: schema } as any }}
              href={state.useStarterKit ? 'download-example' : 'language-selection'}
              tabIndex={index}
              key={schema.name}
            />
          ))}
        </BorderBox>
      )}
      {!state.useStarterKit && nonEmptySchemas.length > 0 && (
        <BorderBox flexDirection="column" title={chalk.bold(`Empty ${schemaWord}s`)} marginTop={1}>
          {nonEmptySchemas.map((schema, index) => (
            <Link
              label={schema.name}
              state={{ dbCredentials: { [schemaWord]: schema.name } as any }}
              href="introspection"
              tabIndex={index + emptySchemas.length}
              key={schema.name}
              description={`${schema.countOfTables} tables, ${humanSize(schema.sizeInBytes)}`}
              padding={30}
            />
          ))}
        </BorderBox>
      )}
      <Link label="Back" description="(Database options)" tabIndex={schemas.length + 1} kind="back" />
    </Box>
  )
}

export default Step4SelectDatabase

function humanSize(size: number) {
  if (size === 0) {
    return `0kB`
  }
  var i = Math.floor(Math.log(size) / Math.log(1024))
  return Number((size / Math.pow(1024, i)).toFixed(2)) * 1 + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i]
}
