import React from 'react'
import { Color, Box } from 'ink'
import BorderBox from '../components/BorderBox'
import chalk from 'chalk'
import { Link } from '../components/Link'
import { useInitState } from '../components/InitState'
import { DatabaseType } from 'prisma-datamodel'
import { useConnector } from '../components/useConnector'
import { SuccessBox } from '../components/ErrorBox'
import { prettyDb } from '../utils/print'

const Step2ChooseDatabase: React.FC = () => {
  const [state] = useInitState()

  const { schemas, selectedDatabaseMeta } = useConnector()
  if (!state.dbCredentials) {
    throw new Error('Missing credentials in choose db view')
  }
  const { dbCredentials } = state
  const db = prettyDb(dbCredentials.type)
  const schemaWord = dbCredentials.type === DatabaseType.postgres ? 'schema' : 'database'

  const schemaCount = state.useStarterKit ? schemas!.filter(s => s.countOfTables === 0).length : schemas!.length

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <SuccessBox>
          Connected to {db} database
          {dbCredentials.user && (
            <>
              {'as '} <Color bold>{dbCredentials.user}</Color>
            </>
          )}
        </SuccessBox>
      </Box>
      {selectedDatabaseMeta && selectedDatabaseMeta.countOfTables > 0 ? (
        <Color bold>
          <Box flexDirection="column">
            <Box>
              The {db} {schemaWord} `{selectedDatabaseMeta.name}` is not empty.
            </Box>
            <Box>When using a starter kit, you must provide an empty {schemaWord}.</Box>
            <Box>
              Create a new {db} {schemaWord} or use an empty one.
            </Box>
          </Box>
        </Color>
      ) : (
        <Box flexDirection="column">
          <Color bold>
            Create a new {db} {schemaWord} or use an existing one
          </Color>
          <Color dim>A {db} database server can host multiple databases</Color>
        </Box>
      )}
      <BorderBox flexDirection="column" title={chalk.bold('Database options')} marginTop={1} marginBottom={1}>
        <Link
          label="Create new MySQL database"
          href="database-name"
          description="Start from scratch"
          tabIndex={0}
          padding={30}
        />
        {schemaCount > 0 && (
          <Link
            label="Use existing MySQL database"
            href="select-database"
            description={`Found ${schemaCount} databases`}
            tabIndex={1}
            padding={30}
          />
        )}
      </BorderBox>
      <Link label="Back" description="(Database credentials)" tabIndex={3} kind="back" />
    </Box>
  )
}

export default Step2ChooseDatabase
