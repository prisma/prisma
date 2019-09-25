import React, { useState } from 'react'
import { Color, Box } from 'ink'
import { BorderBox, TextInput } from '@prisma/ink-components'
import chalk from 'chalk'
import { Link } from '../components/Link'

// We can't use this screen yet, as we don't have SQLite introspection yet
const Step21SqliteFilePath: React.FC = () => {
  const [filePath, setFilePath] = useState('')

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" marginLeft={2}>
        <Color bold>Enter the path to your SQLite database file</Color>
        <Color dim>Prisma will introspect the database</Color>
      </Box>
      <BorderBox flexDirection="column" title={chalk.bold('SQLite database file')} marginTop={1} marginBottom={1}>
        <TextInput tabIndex={0} label="File path" value={filePath} onChange={setFilePath} placeholder="./my.db" />
      </BorderBox>
      <Link label="Introspect" href="introspection" tabIndex={1} kind="forward" />
      <Link label="Back" description="(Database options)" tabIndex={2} kind="back" />
    </Box>
  )
}

export default Step21SqliteFilePath
