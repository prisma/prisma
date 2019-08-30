import React, { useEffect, useState } from 'react'
import { Color, Box } from 'ink'
import BorderBox from '../components/BorderBox'
import chalk from 'chalk'
import { Link } from '../components/Link'
import { useInitState } from '../components/InitState'
import fs from 'fs'
import { promisify } from 'util'
import EmptyDirError from '../components/EmptyDirError'

const readdir = promisify(fs.readdir)
const exists = promisify(fs.exists)

const Step3LanguageSelection: React.FC = () => {
  const [state] = useInitState()
  const nextHref = state.useStarterKit ? 'starter-selection' : 'demo-script-selection'
  const backText = state.useStarterKit ? '(Project options)' : '(Tool selection)'

  const [showEmptyDirError, setShowEmptyDirError] = useState(false)

  useEffect(() => {
    async function runEffect() {
      if (state.useStarterKit) {
        if (await exists(state.outputDir)) {
          const files = await readdir(state.outputDir)
          if (files.length > 0) {
            setShowEmptyDirError(true)
            setTimeout(() => {
              process.exit(1)
            })
          }
        }
      }
    }
    runEffect()
  }, [state])
  return (
    <Box flexDirection="column">
      {showEmptyDirError ? (
        <EmptyDirError />
      ) : (
        <>
          <Box flexDirection="column" marginLeft={2}>
            <Color bold>Select the programming language you want to use.</Color>
            <Color dim>Specifies the language for Photon (database client).</Color>
          </Box>
          <BorderBox
            flexDirection="column"
            title={chalk.bold('Photon is available in these languages')}
            marginTop={1}
            marginBottom={1}
          >
            <Link label="JavaScript" href={nextHref} tabIndex={0} state={{ selectedLanguage: 'javascript' }} />
            <Link label="TypeScript" href={nextHref} tabIndex={1} state={{ selectedLanguage: 'typescript' }} />
            <Box marginLeft={2}>
              <Color dim>Go (Coming soon)</Color>
            </Box>
          </BorderBox>
          <Link label="Back" description={backText} tabIndex={3} kind="back" />
        </>
      )}
    </Box>
  )
}

export default Step3LanguageSelection
