import React, { useEffect } from 'react'
import { Color, Box } from 'ink'
import BorderBox from '../components/BorderBox'
import chalk from 'chalk'
import { Link } from '../components/Link'
import { useFetch } from '../components/Fetcher'

const Step6Success: React.FC = () => {
  // already cache the result for later screens
  useFetch('https://raw.githubusercontent.com/prisma/prisma-examples/prisma2/api.json')
  useEffect(() => {
    setTimeout(() => {
      process.exit()
    }, 5)
  })
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Color dim>~/Desktop $</Color> prisma init PROJECT_NAME
      </Box>
      <Box marginLeft={2} marginBottom={1}>
        <Color green>
          <Color bgKeyword="green" white>
            <Color bold> SUCCESS </Color>
          </Color>{' '}
          Congratulations, you're all set!
        </Color>
      </Box>
      <BorderBox flexDirection="column" title={chalk.bold('Info')}>
        <Box marginLeft={2} marginBottom={1} flexDirection="column">
          <Color>
            The <Color bold>PROJECT_NAME</Color> directory was created. It contains your{' '}
          </Color>
          <Color>Prisma setup and the starter code for a EXAMPLE_NAME.</Color>
        </Box>
        <Box marginLeft={2} marginBottom={1} flexDirection="column">
          <Color>Prisma is connected to your database at:</Color>
          <Color>
            <Color bold>DB_HOST</Color> as <Color bold>DB_USER</Color>
          </Color>
        </Box>
        <Box marginLeft={2} marginBottom={1} flexDirection="column">
          <Color>Your database has been seeded with the data in:</Color>
          <Color bold>PROJECT_NAME/PATH/TO/SEEDING/FILE</Color>
        </Box>
        <Box marginLeft={2} flexDirection="column">
          <Color>If you encounter any issues, please report them here:</Color>
          <Color bold>ISSUES_LINK</Color>
        </Box>
      </BorderBox>
      <BorderBox flexDirection="column" marginTop={1} marginBottom={1} title={chalk.bold('Next steps')}>
        <Box marginLeft={2} width={100} flexDirection="column">
          <Color>Navigate into the project directory:</Color>
          <Box marginBottom={1} flexDirection="column">
            <Color bold>$ cd PROJECT_NAME</Color>
          </Box>
          <Color>Start Prisma's development mode to enable access to</Color>
          <Color>
            Prisma Studio and watch <Color bold>schema.prisma</Color> for changes:
          </Color>
          <Box marginBottom={1} flexDirection="column">
            <Color bold>$ prisma dev</Color>
          </Box>
          <Box marginBottom={1} flexDirection="column">
            <Color>CUSTOM_INSTRUCTIONS_FOR_EXAMPLE</Color>
            <Color>...</Color>
          </Box>
          <Color>Explore sample operations and evolve the project:</Color>
          <Color bold>EXAMPLE_SHORTLINK</Color>
        </Box>
      </BorderBox>
    </Box>
  )
}

export default Step6Success
