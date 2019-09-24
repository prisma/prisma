import React, { useContext, useState } from 'react'
import { Box, Color } from 'ink'
import { BorderBox, ErrorBox, FixBox, DummySelectable } from '@prisma/ink-components'
import chalk from 'chalk'
import { Link } from '../components/Link'
import { useInitState } from '../components/InitState'
import { DatabaseType } from 'prisma-datamodel'
import { useConnector } from '../components/useConnector'
import { prettyDb } from '../utils/print'
import { RouterContext } from '../components/Router'
import { createDatabase } from '@prisma/lift'
import Spinner from 'ink-spinner'
const AnySpinner: any = Spinner

const Step2CreateOrSelectDB: React.FC = () => {
  const [state] = useInitState()
  const [error, setError] = useState('')
  const [creatingDb, setCreatingDb] = useState(false)

  const router = useContext(RouterContext)
  const { schemas, disconnect, connector, connect } = useConnector()
  if (!state.dbCredentials) {
    throw new Error('Missing credentials in choose db view')
  }
  const { dbCredentials } = state
  const db = prettyDb(dbCredentials.type)
  const schemaWord = dbCredentials.type === DatabaseType.postgres ? 'schema' : 'database'
  const dbName = dbCredentials[schemaWord]!

  const schemaCount = state.useStarterKit ? schemas!.filter(s => s.countOfTables === 0).length : schemas!.length
  const href = dbCredentials.type === DatabaseType.postgres ? 'postgres-credentials' : 'mysql-credentials'

  const goBack = async () => {
    await disconnect()
    router.setRoute(href)
  }

  const onCreate = async () => {
    try {
      setCreatingDb(true)
      await createDatabase(dbCredentials.uri!)
      if (!connector) {
        await connect(dbCredentials)
      }
      setCreatingDb(false)
      router.setRoute(state.useStarterKit ? 'download-example' : 'language-selection')
    } catch (e) {
      setCreatingDb(false)
      setError(e.message || JSON.stringify(e))
    }
  }

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" marginLeft={2}>
        <Color bold>
          A {schemaWord} named `{dbName}` doesn't exist on this {db} server.
        </Color>
        <Color bold>
          Create {db} database `{dbName}` or select an existing one.
        </Color>
      </Box>
      <BorderBox flexDirection="column" title={chalk.bold('Database options')} marginTop={1} marginBottom={1}>
        {creatingDb ? (
          <DummySelectable tabIndex={0}>
            <Color cyan>
              <AnySpinner /> Creating {schemaWord} `{dbName}`
            </Color>
          </DummySelectable>
        ) : (
          !error && (
            <Link
              label={`Create ${db} ${schemaWord} \`${dbName}\``}
              description="Start from scratch"
              tabIndex={0}
              padding={40}
              onSelect={onCreate}
            />
          )
        )}
        {schemaCount > 0 && (
          <Link
            label={`Use existing ${db} ${schemaWord}`}
            href="select-database"
            description={`Found ${schemaCount} ${schemaWord}${schemaCount === 1 ? '' : 's'}`}
            tabIndex={1}
            padding={40}
          />
        )}
      </BorderBox>
      {error && error.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <ErrorBox>{error}</ErrorBox>
          <FixBox>Make sure you have the correct rights to create the database.</FixBox>
        </Box>
      )}
      <Link onSelect={goBack} label="Back" description="(Database credentials)" tabIndex={3} kind="back" />
    </Box>
  )
}

export default Step2CreateOrSelectDB
