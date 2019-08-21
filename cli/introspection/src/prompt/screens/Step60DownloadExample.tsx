import React from 'react'
import { Color, Box } from 'ink'
import BorderBox from '../components/BorderBox'
import chalk from 'chalk'
import { Link } from '../components/Link'

const Step60DownloadExample: React.FC = () => {
  return (
    <Box flexDirection="column">
      <Box flexDirection="column" marginLeft={2}>
        <Color bold>Select the database you want to use.</Color>
        <Color dim>Use SQLite if you don't have a database running yet.</Color>
      </Box>
      <BorderBox flexDirection="column" title={chalk.bold('Supported databases')} marginTop={1} marginBottom={1}>
        <Link label="SQLite" href="success" description="Easiest to set up" tabIndex={0} />
        <Link label="MySQL" href="mysql-blank" description="Requires running a MySQL database" tabIndex={1} />
        <Link
          label="PostgreSQL"
          href="postgres-blank"
          description="Requires running a PostgreSQL database"
          tabIndex={2}
        />
        <Box marginLeft={2}>
          <Color dim>MongoDB {'      '} (Coming soon)</Color>
        </Box>
      </BorderBox>
      <Link label="Back" href="home" description="(Project options)" tabIndex={3} kind="back" />
    </Box>
  )
}

export default Step60DownloadExample
