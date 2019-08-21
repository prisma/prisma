import React, { useContext } from 'react'
import { Color, Box } from 'ink'
import BorderBox from '../components/BorderBox'
import chalk from 'chalk'
import { Link } from '../components/Link'
import { InkLink } from '../components/InkLink'
import { Checkbox } from '../components/inputs/Checkbox'
import { useInitState } from '../components/InitState'

const Step22ToolSelection: React.FC = () => {
  const [state, { setState }] = useInitState()

  const nextStep = state.usePhoton ? 'demo-script-selection' : 'process-blank'

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" marginLeft={2}>
        <Color bold>Select the Prisma 2 tools you want to use.</Color>
        <Color dim>
          Learn more: <InkLink url="https://github.com/prisma/prisma2" />
        </Color>
      </Box>
      <BorderBox
        flexDirection="column"
        title={chalk.bold('Prisma 2 tools') + chalk.dim(' (toggle with space)')}
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
      <Link label="Back" description="(Project options)" tabIndex={3} kind="back" />
    </Box>
  )
}

export default Step22ToolSelection
