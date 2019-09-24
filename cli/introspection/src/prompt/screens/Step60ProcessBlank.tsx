import React, { useEffect, useContext } from 'react'
import { Color, Box } from 'ink'
import { useInitState } from '../components/InitState'
import fs from 'fs'
import path from 'path'
import { printSchema } from '../utils/templates'
import { RouterContext } from '../components/Router'
import { sync as makeDirSync } from 'make-dir'
import { useExampleApi } from '../utils/useExampleApi'
import { sqliteDefault, photonDefaultConfig } from '../utils/defaults'
import { useConnector } from '../components/useConnector'
import { replaceGenerator } from '../utils/replaceDatasource'

const Step60ProcessBlank: React.FC = () => {
  const [state, { setState }] = useInitState()
  const router = useContext(RouterContext)
  const examples = useExampleApi()
  const { introspectionResult } = useConnector()
  useEffect(() => {
    async function run() {
      // perform actions to get blank project going...
      // state.blank??
      if (introspectionResult) {
        makeDirSync(path.join(state.outputDir, './prisma'))
        const schema = state.usePhoton
          ? await replaceGenerator(introspectionResult, photonDefaultConfig)
          : introspectionResult
        fs.writeFileSync(path.join(state.outputDir, './prisma/schema.prisma'), schema)
        router.setRoute('success')
        return
      }
      if (!state.dbCredentials && state.selectedDb === 'sqlite') {
        setState({
          dbCredentials: sqliteDefault,
        })
        return
      }
      if (state.useDemoScript && state.selectedLanguage) {
        if (examples) {
          // TODO: Add more error handling if it can't be found
          const example = examples.examples[state.selectedLanguage].script
          setState({ selectedExample: example })
          router.setRoute('download-example')
        }
        // if just the schema is being selected
      } else if (!state.useDemoScript) {
        makeDirSync(path.join(state.outputDir, './prisma'))
        fs.writeFileSync(
          path.join(state.outputDir, './prisma/schema.prisma'),
          printSchema({ usePhoton: state.usePhoton, credentials: state.dbCredentials! }),
        )
        router.setRoute('success')
      }
    }
    run()
  }, [state, examples])

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" marginLeft={2}>
        <Color bold>Processing the blank project</Color>
      </Box>
    </Box>
  )
}

export default Step60ProcessBlank
