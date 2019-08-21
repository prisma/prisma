import React from 'react'
import { Color, Box } from 'ink'
import BorderBox from '../components/BorderBox'
import { Link } from '../components/Link'

const Step4DemoScriptSelection: React.FC = () => {
  return (
    <Box flexDirection="column">
      <Box flexDirection="column" marginLeft={2}>
        <Color bold>Start with a runnable demo script or just the Prisma schema</Color>
        <Color dim>Demo scripts showcase usage of the Photon API</Color>
      </Box>
      <BorderBox flexDirection="column" marginTop={1} marginBottom={1}>
        <Link
          label="Demo script"
          description="Simple script with API examples"
          href="process-blank"
          tabIndex={0}
          state={{ useDemoScript: true }}
          padding={24}
        />
        <Link
          label="Just the Prisma schema"
          description="Most minimal setup"
          href="process-blank"
          tabIndex={1}
          state={{ useDemoScript: false }}
          padding={24}
        />
      </BorderBox>
      <Link label="Back" description="(Tool selection)" tabIndex={2} kind="back" />
    </Box>
  )
}

export default Step4DemoScriptSelection
