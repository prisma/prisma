import React, { useState, useEffect } from 'react'
import { Color, Box } from 'ink'
import BorderBox from '../components/BorderBox'
import chalk from 'chalk'
import { Link } from '../components/Link'
import { TextInput } from '../components/inputs/TextInput'
import { InkLink } from '../components/InkLink'
import { useInitState } from '../components/InitState'
import { DatabaseType } from 'prisma-datamodel'
import { Checkbox } from '../components/inputs/Checkbox'
import { useConnector } from '../components/useConnector'
import { ErrorBox } from '../components/ErrorBox'

// We can't use this screen yet, as we don't have SQLite introspection yet
const Step1MySQLCredentials: React.FC = () => {
  const [state, { setDbCredentials }] = useInitState()
  const { connect, error, connected, connector } = useConnector()

  const dbCredentials = state.dbCredentials!
  const [next, setNext] = useState('')

  useEffect(() => {
    async function runEffect() {
      if (connected) {
        if (dbCredentials.database) {
          // introspect this db
          // is there sth in there?
          const meta = await connector!.connector.getMetadata(dbCredentials.database)
          if (meta.countOfTables > 0) {
            // introspect
            setNext('introspection')
          } else {
            // okay dokay - we go for normal language selection, then sample script yes no
            setNext('oken doken')
          }
        } else {
          // show the user which options she has
        }
      }
    }
    runEffect()
  }, [connected])

  return (
    <Box flexDirection="column">
      {connected && 'OMG WE ARE CONNECTED'}
      {next && 'next: ' + next}
      <Box flexDirection="column" marginLeft={2}>
        <Color bold>Connect to your MySQL database</Color>
        <Color dim>
          <InkLink url="https://pris.ly/docs/core/connectors/mysql.md" />
        </Color>
      </Box>
      <BorderBox flexDirection="column" title={chalk.bold('MySQL database credentials')} marginTop={1}>
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
          placeholder="3306"
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
          label="Database (optional)"
          value={dbCredentials.database || ''}
          onChange={database => setDbCredentials({ database })}
          placeholder=""
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
        />
      </BorderBox>

      {error && <ErrorBox>{error}</ErrorBox>}
      <Link label="Connect" onSelect={() => connect(state.dbCredentials!)} tabIndex={7} kind="forward" />
      <Link label="Back" href="sqlite-file-selection" description="(Database options)" tabIndex={8} kind="back" />
    </Box>
  )
}

export default Step1MySQLCredentials
