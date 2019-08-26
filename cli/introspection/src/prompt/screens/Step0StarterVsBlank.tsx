import React, { useEffect } from 'react'
import { Color, Box } from 'ink'
import BorderBox from '../components/BorderBox'
import chalk from 'chalk'
import { Link } from '../components/Link'
import { useExampleApi } from '../utils/useExampleApi'
import { useInitState } from '../components/InitState'

type Props = {
  outputDir: string
}

const Step0StarterVsBlank: React.FC<Props> = ({ outputDir }) => {
  // already cache the result for later screens

  useExampleApi()
  return (
    <Box flexDirection="column">
      <Box flexDirection="column" marginLeft={2}>
        <Color bold>Get started with a blank project or a starter kit.</Color>
        <Color dim>Starter kits provide ready-made setups for various use cases.</Color>
      </Box>
      <BorderBox flexDirection="column" title={chalk.bold('Languages for starter kits')} marginTop={1}>
        <Link
          label="Blank project"
          href="db-selection"
          description="Supports introspecting your existing DB"
          tabIndex={0}
        />
        <Link
          label="TypeScript"
          state={{ selectedLanguage: 'ts' }}
          href="starter-selection"
          description="GraphQL, REST, gRPC, ..."
          tabIndex={1}
        />
      </BorderBox>
    </Box>
  )
}

export default Step0StarterVsBlank
