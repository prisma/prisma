import React, { useEffect } from 'react'
import { Color, Box } from 'ink'
import BorderBox from '../components/BorderBox'
import chalk from 'chalk'
import { useInitState } from '../components/InitState'
import path from 'path'
import { InkLink } from '../components/InkLink'
import { credentialsToUri } from '../../convertCredentials'

const Step61Success: React.FC = () => {
  useEffect(() => {
    setTimeout(() => {
      process.exit(0)
    }, 5)
  })
  const [state] = useInitState()
  const directoryCreated = state.outputDir !== process.cwd()
  const dirName = directoryCreated ? path.relative(process.cwd(), state.outputDir) : null
  const issuesLink =
    (state.selectedExample && state.selectedExample!.issuesLink) || 'https://github.com/prisma/prisma2/issues/new'

  const connectionString =
    state.dbCredentials &&
    (state.dbCredentials.host || state.dbCredentials.uri || credentialsToUri(state.dbCredentials))

  return (
    <Box flexDirection="column">
      <Box marginLeft={2} flexDirection="column" textWrap="wrap">
        {directoryCreated && (
          <Color green>
            <Color bgKeyword="green" white>
              <Color bold> SUCCESS </Color>
            </Color>{' '}
            The <Color bold>{dirName}</Color> directory was created!
          </Color>
        )}
        <Color green>
          <Box textWrap="wrap">
            <Color bgKeyword="green" white>
              <Color bold> SUCCESS </Color>
            </Color>{' '}
            Prisma is connected to your database at <Color bold>{connectionString || ''}</Color>
          </Box>
        </Color>
      </Box>
      <BorderBox flexDirection="column" marginTop={1} marginBottom={1} title={chalk.bold('Next steps')}>
        <Box marginLeft={2} width={100} flexDirection="column">
          {directoryCreated && (
            <Box marginBottom={1} flexDirection="column">
              <Color dim>Navigate into the project directory:</Color>
              <Box flexDirection="column">
                <Color bold>$ cd {dirName}</Color>
              </Box>
            </Box>
          )}
          <Box flexDirection="column">
            <Color dim>Start Prisma's development mode to enable access to</Color>
            <Color dim>
              Prisma Studio and watch <Color bold>schema.prisma</Color> for changes:
            </Color>
            <Color bold>$ prisma dev</Color>
          </Box>
          {state.selectedExample &&
            state.selectedExample!.nextStepInstructions.map(instruction => (
              <Box marginTop={1} flexDirection="column" key={instruction.description}>
                <Color dim>{instruction.description || null}</Color>
                {instruction.commands.map(command => (
                  <Color key={command} bold>
                    $ {command}
                  </Color>
                ))}
              </Box>
            ))}
          <Box marginTop={1} flexDirection="column">
            <Color dim>Learn more about Prisma 2:</Color>
            <InkLink url="https://github.com/prisma/prisma2/" />
          </Box>
          <Box marginTop={1} flexDirection="column">
            <Color dim>If you encounter any issues, please report them here:</Color>
            <InkLink url={issuesLink} />
          </Box>
        </Box>
      </BorderBox>
    </Box>
  )
}

export default Step61Success
