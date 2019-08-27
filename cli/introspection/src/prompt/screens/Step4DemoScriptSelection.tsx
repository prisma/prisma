import React, { useEffect } from 'react'
import { Color, Box } from 'ink'
import BorderBox from '../components/BorderBox'
import { Link } from '../components/Link'
import { useInitState } from '../components/InitState'
import { useExampleApi } from '../utils/useExampleApi'
import { Example } from '../types'

const Step4DemoScriptSelection: React.FC = () => {
  const [state] = useInitState()
  const examples = useExampleApi()
  let potentialExample
  if (examples && state.selectedLanguage) {
    potentialExample = examples.examples[state.selectedLanguage].script
  }
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
          href="download-example"
          tabIndex={0}
          state={{ useDemoScript: true, selectedExample: potentialExample }}
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
