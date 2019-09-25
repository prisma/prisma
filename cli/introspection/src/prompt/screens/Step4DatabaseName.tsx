import React, { useState, useContext, useEffect } from 'react'
import { Color, Box } from 'ink'
import { BorderBox, TextInput, ErrorBox, FixBox, DummySelectable } from '@prisma/ink-components'
import chalk from 'chalk'
import { Link } from '../components/Link'
import { useInitState } from '../components/InitState'
import { prettyDb } from '../utils/print'
import { DatabaseType } from 'prisma-datamodel'
import { RouterContext } from '../components/Router'
import { createDatabase } from '@prisma/lift'
import Spinner from 'ink-spinner'
const AnySpinner: any = Spinner

// We can't use this screen yet, as we don't have SQLite introspection yet
const Step4DatabaseName: React.FC = () => {
  const [state, { setDbCredentials }] = useInitState()
  const [creatingDb, setCreatingDb] = useState(false)

  if (!state.dbCredentials) {
    throw new Error('Missing credentials in database name view')
  }
  const { dbCredentials } = state
  const db = prettyDb(dbCredentials.type)
  const schemaWord = dbCredentials.type === DatabaseType.postgres ? 'schema' : 'database'
  const dbName = dbCredentials[schemaWord]!

  const router = useContext(RouterContext)

  const [error, setError] = useState<null | string>(null)

  useEffect(() => {
    const nameRegex = /[0-9a-zA-Z$_]+/
    const schema = dbCredentials[schemaWord]!
    if (!nameRegex.test(schema)) {
      setError('Invalid database name')
    } else {
      setError(null)
    }
  }, [dbCredentials])

  const onCreate = async () => {
    try {
      setCreatingDb(true)
      await createDatabase(dbCredentials.uri!)
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
        <Color bold>Enter the name for the new {schemaWord}</Color>
        <Color dim>
          The {schemaWord} will be created by: <Color bold>{state.dbCredentials!.user}</Color>
        </Color>
      </Box>
      <BorderBox flexDirection="column" title={chalk.bold(`${db} ${schemaWord} name`)} marginTop={1} marginBottom={1}>
        <TextInput
          tabIndex={0}
          label="Name"
          value={state.dbCredentials[schemaWord] || ''}
          onChange={value => setDbCredentials({ [schemaWord]: value })}
          placeholder="my_db"
          onSubmit={onCreate}
        />
      </BorderBox>
      {creatingDb ? (
        <DummySelectable tabIndex={0}>
          <Color cyan>
            <AnySpinner /> Creating {schemaWord} `{dbName}`
          </Color>
        </DummySelectable>
      ) : (
        <Link label={`Create`} tabIndex={1} onSelect={onCreate} />
      )}
      {error && error.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <ErrorBox>{error}</ErrorBox>
          <FixBox>Make sure you have the correct rights to create the database.</FixBox>
        </Box>
      )}
      <Link label="Back" description="(Database options)" tabIndex={2} kind="back" />
    </Box>
  )
}

export default Step4DatabaseName
