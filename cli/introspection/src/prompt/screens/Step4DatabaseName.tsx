import React, { useState, useContext, useEffect } from 'react'
import { Color, Box } from 'ink'
import BorderBox from '../components/BorderBox'
import chalk from 'chalk'
import { Link } from '../components/Link'
import { TextInput } from '../components/inputs/TextInput'
import { useInitState } from '../components/InitState'
import { prettyDb } from '../utils/print'
import { DatabaseType } from 'prisma-datamodel'
import { RouterContext } from '../components/Router'

// We can't use this screen yet, as we don't have SQLite introspection yet
const Step4DatabaseName: React.FC = () => {
  const [state, { setDbCredentials }] = useInitState()

  if (!state.dbCredentials) {
    throw new Error('Missing credentials in database name view')
  }
  const { dbCredentials } = state
  const db = prettyDb(dbCredentials.type)
  const schemaWord = dbCredentials.type === DatabaseType.postgres ? 'schema' : 'database'
  const href = state.useStarterKit ? 'download-example' : 'language-selection'

  const router = useContext(RouterContext)

  const next = () => {
    if (!error) {
      router.setRoute(href)
    }
  }

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
          onSubmit={next}
        />
      </BorderBox>
      {!error && <Link label="Create" href={href} tabIndex={1} kind="forward" />}
      <Link label="Back" description="(Database options)" tabIndex={2} kind="back" />
    </Box>
  )
}

export default Step4DatabaseName
