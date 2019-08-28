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

// We can't use this screen yet, as we don't have SQLite introspection yet
const Step1MySQLCredentials: React.FC = () => {
  const [state, { setDbCredentials }] = useInitState()

  const dbCredentials = state.dbCredentials!

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" marginLeft={2}>
        <Color bold>Connect to your MySQL database server</Color>
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
      <Link label="Introspect" href="introspection" tabIndex={7} kind="forward" />
      <Link label="Back" href="sqlite-file-selection" description="(Database options)" tabIndex={8} kind="back" />
    </Box>
  )
}

export default Step1MySQLCredentials
