import React, { useContext } from 'react'
import { Color, Box } from 'ink'
import { BorderBox, InkLink, Checkbox } from '@prisma/ink-components'
import chalk from 'chalk'
import { Link } from '../components/Link'
import { useInitState } from '../components/InitState'
import { useConnector } from '../components/useConnector'
import { RouterContext } from '../components/Router'

const Step22ToolSelection: React.FC = () => {
  const [state, { setState }] = useInitState()
  const { introspectionResult, disconnect } = useConnector()

  const nextStep = state.usePhoton ? 'language-selection' : 'process-blank'

  const backLabel = state.useBlank ? '(Database credentials)' : '(Project options)'

  const router = useContext(RouterContext)

  const goBack = async () => {
    await disconnect()
    const backTo = state.selectedDb === 'mysql' ? 'mysql-credentials' : 'postgres-credentials'
    router.backTo(backTo)
  }

  return (
    <Box flexDirection="column">
      {introspectionResult && (
        <Box marginBottom={1}>
          <Color green>
            <Color bgKeyword="green" white>
              <Color bold> SUCCESS </Color>
            </Color>{' '}
            Introspection was successful.
          </Color>
        </Box>
      )}
      <Box flexDirection="column" marginLeft={2}>
        <Color bold>Select the Prisma 2 tools you want to use.</Color>
        <Color dim>
          Learn more: <InkLink url="https://github.com/prisma/prisma2" />
        </Color>
      </Box>
      <BorderBox
        flexDirection="column"
        title={chalk.bold('Prisma 2 tools') + chalk.dim(` (toggle with [space])`)}
        marginTop={1}
        marginBottom={1}
      >
        <Checkbox
          tabIndex={0}
          checked={state.usePhoton}
          label="Photon"
          description="Type-safe database client"
          onChange={usePhoton => setState({ usePhoton })}
        />
        <Checkbox
          tabIndex={1}
          checked={state.useLift}
          label="Lift"
          description="Declarative data modeling & migrations"
          onChange={useLift => setState({ useLift })}
        />
        <Box marginLeft={2} marginTop={1}>
          <Color dim>Note: You can still add a tool to your project later</Color>
        </Box>
      </BorderBox>
      <Link label="Confirm" href={nextStep} tabIndex={2} kind="forward" />
      <Link
        label="Back"
        onSelect={state.useBlank ? goBack : undefined}
        description={backLabel}
        tabIndex={3}
        kind="back"
      />
    </Box>
  )
}

export default Step22ToolSelection
