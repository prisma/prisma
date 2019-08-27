import React, { useEffect, useContext } from 'react'
import { Color, Box } from 'ink'
import { useInitState } from '../components/InitState'
import fs from 'fs'
import path from 'path'
import { printSchema } from '../utils/templates'
import { RouterContext } from '../components/Router'
import { sync as makeDirSync } from 'make-dir'
import { useExampleApi } from '../utils/useExampleApi'
import { DatabaseType } from 'prisma-datamodel'

const Step60ProcessBlank: React.FC = () => {
  const [state, { setState }] = useInitState()
  const router = useContext(RouterContext)
  const examples = useExampleApi()
  useEffect(() => {
    // perform actions to get blank project going...
    // state.blank??
    if (!state.dbCredentials && state.selectedDb === 'sqlite') {
      setState({
        dbCredentials: {
          type: DatabaseType.sqlite,
          uri: 'file:dev.db',
        },
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
    } else if (state.selectedDb === 'sqlite' && !state.useDemoScript) {
      makeDirSync(path.join(state.outputDir, './prisma'))
      fs.writeFileSync(
        path.join(state.outputDir, './prisma/schema.prisma'),
        printSchema({ usePhoton: state.usePhoton, credentials: state.dbCredentials! }),
      )
      router.setRoute('success')
    }
  }, [state, examples])

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" marginLeft={2}>
        <Color bold>Processsing the blank stuff...</Color>
        <Color dim>Please wait a few years</Color>
        {JSON.stringify(state)}
      </Box>
    </Box>
  )
}

export default Step60ProcessBlank
