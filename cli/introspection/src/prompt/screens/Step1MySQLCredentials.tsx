import React, { useState, useEffect, useContext } from 'react'
import { Color, Box } from 'ink'
import chalk from 'chalk'
import { Link } from '../components/Link'
import { useInitState } from '../components/InitState'
import { useConnector } from '../components/useConnector'
import { RouterContext } from '../components/Router'

import { TextInput, InkLink, BorderBox, ErrorBox, Checkbox, DummySelectable } from '@prisma/ink-components'

import Spinner from 'ink-spinner'
const AnySpinner: any = Spinner

const Step1MySQLCredentials: React.FC = () => {
  const [state, { setDbCredentials }] = useInitState()
  const { connect, error, connected, connector, connecting, getMetadata, selectedDatabaseMeta } = useConnector()

  const dbCredentials = state.dbCredentials!
  const [next, setNext] = useState('')
  const router = useContext(RouterContext)

  useEffect(() => {
    async function runEffect() {
      if (connected) {
        if (dbCredentials.database && selectedDatabaseMeta) {
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
            router.setRoute('create-or-select-db')
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
        <Color bold>Connect to your MySQL database</Color>
        <Color dim>
          <InkLink url="https://pris.ly/d/mysql-connector" />
        </Color>
      </Box>
      <BorderBox flexDirection="column" title={chalk.bold('MySQL database credentials')} marginTop={1}>
        <TextInput
          tabIndex={0}
          label="Host"
          value={dbCredentials.host || ''}
          onChange={host => setDbCredentials({ host })}
          placeholder="localhost"
          onSubmit={() => connect(state.dbCredentials!)}
        />
        <TextInput
          tabIndex={1}
          label="Port"
          value={String(dbCredentials.port || '')}
          onChange={port => setDbCredentials({ port: Number(port) })}
          placeholder="3306"
          onSubmit={() => connect(state.dbCredentials!)}
        />
        <TextInput
          tabIndex={2}
          label="User"
          value={dbCredentials.user || ''}
          onChange={user => setDbCredentials({ user })}
          placeholder="user"
          onSubmit={() => connect(state.dbCredentials!)}
        />
        <TextInput
          tabIndex={3}
          label="Password"
          value={dbCredentials.password || ''}
          onChange={password => setDbCredentials({ password })}
          placeholder=""
          onSubmit={() => connect(state.dbCredentials!)}
        />
        <TextInput
          tabIndex={4}
          label={`Database ${chalk.dim('(optional)')}`}
          value={dbCredentials.database || ''}
          onChange={database => setDbCredentials({ database })}
          placeholder=""
          onSubmit={() => connect(state.dbCredentials!)}
        />
        <Checkbox
          tabIndex={5}
          checked={dbCredentials.ssl || false}
          label="Use SSL"
          onChange={ssl => setDbCredentials({ ssl })}
        />
      </BorderBox>
      <BorderBox
        flexDirection="column"
        title={chalk.bold('MySQL database credentials')}
        extension={true}
        marginBottom={1}
      >
        <TextInput
          tabIndex={6}
          label="URL"
          value={dbCredentials.uri || ''}
          onChange={uri => setDbCredentials({ uri })}
          placeholder="mysql://localhost:3306/admin"
          onSubmit={() => connect(state.dbCredentials!)}
        />
      </BorderBox>

      {error && <ErrorBox>{error}</ErrorBox>}
      {connecting ? (
        <DummySelectable tabIndex={7}>
          <Color cyan>
            <AnySpinner /> Connecting
          </Color>
        </DummySelectable>
      ) : (
        <Link label="Connect" onSelect={() => connect(state.dbCredentials!)} tabIndex={7} kind="forward" />
      )}
      <Link label="Back" description="(Database options)" tabIndex={8} kind="back" />
    </Box>
  )
}

export default Step1MySQLCredentials
