import React from 'react'
import { Color, Box } from 'ink'
import BorderBox from '../components/BorderBox'
import chalk from 'chalk'
import { Link } from '../components/Link'
import { useFetch } from '../components/Fetcher'

const Step0StarterVsBlank: React.FC = () => {
  // already cache the result for later screens
  useFetch('https://raw.githubusercontent.com/prisma/prisma-examples/prisma2/api.json')
  return (
    <Box flexDirection="column">
      <Box flexDirection="column" marginLeft={2}>
        <Color bold>Select the language for a starter kit or start with a blank project.</Color>
        <Color dim>Starter kits provide ready-made setups for various use cases.</Color>
      </Box>
      <BorderBox flexDirection="column" title={chalk.bold('Languages for starter kits')} marginTop={1}>
        <Link label="Javascript" href="starter-selection" description="GraphQL, REST, gRPC, ..." tabIndex={0} />
        <Link label="TypeScript" href="starter-selection" description="GraphQL, REST, gRPC, ..." tabIndex={1} />
        <Box marginLeft={2}>
          <Color dim>Go (Coming soon)</Color>
        </Box>
        <Box marginLeft={2} marginTop={1}>
          <Color dim>Note: Starter kits only work with empty databases</Color>
        </Box>
      </BorderBox>
      <BorderBox flexDirection="column" title={chalk.bold('Get started from scratch')} marginBottom={1} marginTop={1}>
        <Link
          label="Blank Project"
          href="db-selection"
          description="Supports introspecting your existing DB"
          tabIndex={2}
        />
      </BorderBox>
    </Box>
  )
}

export default Step0StarterVsBlank
