import React from 'react'
import { Color, Box } from 'ink'
import BorderBox from '../components/BorderBox'
import chalk from 'chalk'
import { Link } from '../components/Link'
import { useInitState } from '../components/InitState'
import { DatabaseType } from 'prisma-datamodel'
import { sqliteDefault } from '../utils/defaults'

const Step2DBSelection: React.FC = () => {
  const [state] = useInitState()

  const sqliteHref = state.useBlank ? 'tool-selection' : 'download-example'

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" marginLeft={2}>
        <Color bold>Select the database you want to use.</Color>
        <Color dim>Use SQLite if you don't have a database running yet.</Color>
      </Box>
      <BorderBox flexDirection="column" title={chalk.bold('Supported databases')} marginTop={1} marginBottom={1}>
        <Link
          label="SQLite"
          href={sqliteHref}
          description="Easiest to set up"
          tabIndex={0}
          state={{ selectedDb: 'sqlite', dbCredentials: sqliteDefault }}
        />
        <Link
          label="MySQL"
          href="mysql-credentials"
          description="Requires running a MySQL database"
          tabIndex={1}
          state={{ selectedDb: 'mysql', dbCredentials: { type: DatabaseType.mysql } }}
        />
        <Link
          label="PostgreSQL"
          href="postgres-blank"
          description="Requires running a PostgreSQL database"
          tabIndex={2}
          state={{ selectedDb: 'postgres', dbCredentials: { type: DatabaseType.postgres } }}
        />
        <Box marginLeft={2}>
          <Color dim>MongoDB {'      '} (Coming soon)</Color>
        </Box>
      </BorderBox>
      <Link label="Back" href="home" description="(Project options)" tabIndex={3} kind="back" />
    </Box>
  )
}

export default Step2DBSelection
