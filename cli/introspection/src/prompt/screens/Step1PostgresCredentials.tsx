import React, { useState, useEffect, useContext } from 'react'
import { Color, Box } from 'ink'
import BorderBox from '../components/BorderBox'
import chalk from 'chalk'
import { Link } from '../components/Link'
import { TextInput } from '../components/inputs/TextInput'
import { InkLink } from '../components/InkLink'
import { useInitState } from '../components/InitState'
import { Checkbox } from '../components/inputs/Checkbox'
import { useConnector } from '../components/useConnector'
import { ErrorBox } from '../components/ErrorBox'
import { RouterContext } from '../components/Router'
import Spinner from 'ink-spinner'
import DummySelectable from '../components/DummySelectable'
const AnySpinner: any = Spinner

const Step1PostgresCredentials: React.FC = () => {
  const [state, { setDbCredentials }] = useInitState()
  const { connect, error, connected, connecting, selectedDatabaseMeta } = useConnector()

  const dbCredentials = state.dbCredentials!
  const [next, setNext] = useState('')
  const router = useContext(RouterContext)

  useEffect(() => {
    async function runEffect() {
      if (connected) {
        if (dbCredentials.schema && selectedDatabaseMeta) {
          // introspect this db
          // is there sth in there?
          if (selectedDatabaseMeta.countOfTables > 0) {
            // introspect
            if (state.useStarterKit) {
              router.setRoute('choose-database')
            } else {
              router.setRoute('introspection')
            }
          } else {
            router.setRoute('download-example')
          }
        } else {
          router.setRoute('choose-database')
        }
      }
    }
    runEffect()
  }, [connected])

  return (
    <Box flexDirection="column">
      {next}
      <Box flexDirection="column" marginLeft={2}>
        <Color bold>Connect to your PostgreSQL database</Color>
        <Color dim>
          <InkLink url="https://pris.ly/d/postgres-connector" />
        </Color>
      </Box>
      <BorderBox flexDirection="column" title={chalk.bold('PostgreSQL database credentials')} marginTop={1}>
        <TextInput
          tabIndex={0}
          label="Host"
          value={dbCredentials.host || ''}
          onChange={host => setDbCredentials({ host })}
          placeholder="localhost"
        />
        <TextInput
          tabIndex={1}
          label="Port"
          value={String(dbCredentials.port || '')}
          onChange={port => setDbCredentials({ port: Number(port) })}
          placeholder="5432"
        />
        <TextInput
          tabIndex={2}
          label="User"
          value={dbCredentials.user || ''}
          onChange={user => setDbCredentials({ user })}
          placeholder="user"
        />
        <TextInput
          tabIndex={3}
          label="Password"
          value={dbCredentials.password || ''}
          onChange={password => setDbCredentials({ password })}
          placeholder=""
        />
        <TextInput
          tabIndex={4}
          label={`Database`}
          value={dbCredentials.database || ''}
          onChange={database => setDbCredentials({ database })}
          placeholder="postgres"
        />
        <TextInput
          tabIndex={5}
          label={`Schema ${chalk.dim('(optional)')}`}
          value={dbCredentials.schema || ''}
          onChange={schema => setDbCredentials({ schema })}
          placeholder=""
        />
        <Checkbox
          tabIndex={6}
          checked={dbCredentials.ssl || false}
          label="Use SSL"
          onChange={ssl => setDbCredentials({ ssl })}
        />
      </BorderBox>
      <BorderBox
        flexDirection="column"
        title={chalk.bold('PostgreSQL database credentials')}
        extension={true}
        marginBottom={1}
      >
        <TextInput
          tabIndex={7}
          label="URL"
          value={dbCredentials.uri || ''}
          onChange={uri => setDbCredentials({ uri })}
          placeholder="postgresql://localhost:5432/admin"
          onSubmit={() => connect(state.dbCredentials!)}
        />
      </BorderBox>

      {error && <ErrorBox>{error}</ErrorBox>}
      {connecting ? (
        <DummySelectable tabIndex={8}>
          <Color cyan>
            <AnySpinner /> Connecting
          </Color>
        </DummySelectable>
      ) : (
        <Link label="Connect" onSelect={() => connect(state.dbCredentials!)} tabIndex={8} kind="forward" />
      )}
      <Link label="Back" description="(Database options)" tabIndex={9} kind="back" />
    </Box>
  )
}

export default Step1PostgresCredentials
