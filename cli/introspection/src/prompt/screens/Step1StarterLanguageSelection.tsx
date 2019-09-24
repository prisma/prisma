import React, { useEffect } from 'react'
import { Color, Box } from 'ink'
import { BorderBox } from '@prisma/ink-components'
import chalk from 'chalk'
import { Link } from '../components/Link'
import { useExampleApi } from '../utils/useExampleApi'
import { useInitState } from '../components/InitState'

type Props = {
  outputDir: string
}

const Step1StarterLanguageSelection: React.FC<Props> = ({ outputDir }) => {
  // already cache the result for later screens
  const { setState } = useInitState()[1]
  useEffect(() => {
    // setState({ outputDir })
  })

  useExampleApi()
  return (
    <Box flexDirection="column">
      <Box flexDirection="column" marginLeft={2} marginBottom={1}>
        <Color bold>Select the language for your starter kit.</Color>
      </Box>
      <BorderBox flexDirection="column" title={chalk.bold('Starter kits are available in the languages')} marginTop={1}>
        <Link label="Javascript" state={{ selectedLanguage: 'javascript' }} href="starter-selection" tabIndex={0} />
        <Link label="TypeScript" state={{ selectedLanguage: 'typescript' }} href="starter-selection" tabIndex={1} />
        <Box marginLeft={2}>
          <Color dim>Go (Coming soon)</Color>
        </Box>
      </BorderBox>
      <Link label="Back" description="(Project options)" tabIndex={2} kind="back" />
    </Box>
  )
}

export default Step1StarterLanguageSelection
