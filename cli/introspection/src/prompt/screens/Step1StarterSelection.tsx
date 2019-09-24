import React from 'react'
import { Color, Box } from 'ink'
import { BorderBox } from '@prisma/ink-components'
import chalk from 'chalk'
import { Link } from '../components/Link'
import { useExampleApi } from '../utils/useExampleApi'
import { useInitState } from '../components/InitState'

const Step1StarterSelection: React.FC = () => {
  const [state] = useInitState()

  const examples = useExampleApi()

  const language = state.selectedLanguage!

  if (!language) {
    throw new Error(`Can't display starter kit selection without a selected language`)
  }

  let padding =
    (examples &&
      examples.examples &&
      Object.values(examples.examples[language]).reduce<number>((maxLength, example: any) => {
        return Math.max(maxLength, example.name.length)
      }, 0)) ||
    0
  padding += 2 // always add 2 extra margin

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" marginLeft={2}>
        <Color bold>Select the starter kit.</Color>
        <Color dim>You can connect the starter kit to your own database.</Color>
      </Box>
      <BorderBox flexDiretion="column" title={chalk.bold('Available starter kits')} marginTop={1} marginBottom={1}>
        <Box flexDirection="column">
          {examples &&
            Object.values(examples.examples[language]).map((example, index) => (
              <Link
                key={example.name}
                label={example.name}
                href="db-selection"
                description={example.description}
                tabIndex={index}
                padding={padding}
                state={{ selectedExample: example }}
              />
            ))}
        </Box>
      </BorderBox>
      <Link label="Back" description="(Project options)" tabIndex={100} kind="back" />
    </Box>
  )
}

export default Step1StarterSelection
