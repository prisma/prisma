import React from 'react'
import { Color, Box } from 'ink'
import BorderBox from '../components/BorderBox'
import chalk from 'chalk'
import { Link } from '../components/Link'

const Step2SqliteFileSelection: React.FC = () => {
  return (
    <Box flexDirection="column">
      <Box flexDirection="column" marginLeft={2}>
        <Color bold>Create a new SQLite database file or use an existing one</Color>
        <Color dim>
          SQLite databases are stored as <Color bold>.db-files</Color>
        </Color>
      </Box>
      <BorderBox flexDirection="column" title={chalk.bold('Database options')} marginTop={1} marginBottom={1}>
        <Link
          label="Create new SQLite file"
          href="success"
          description="Start from scratch"
          tabIndex={0}
          padding={26}
        />
        <Link
          label="Use existing SQLite file"
          href="sqlite-file-path"
          description="Requires path to SQLite file"
          tabIndex={1}
          padding={26}
        />
      </BorderBox>
      <Link label="Back" href="db-selection" description="(Database selection)" tabIndex={2} kind="back" />
    </Box>
  )
}

export default Step2SqliteFileSelection
