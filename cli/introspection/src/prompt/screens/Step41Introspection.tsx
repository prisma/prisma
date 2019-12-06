import React, { useEffect, useState, useContext } from 'react'
import { Box, Color } from 'ink'
import { useInitState } from '../components/InitState'
import Spinner from 'ink-spinner'
import { useConnector } from '../components/useConnector'
import { RouterContext } from '../components/Router'
import { prettyDb } from '../utils/print'
import { ErrorBox } from '@prisma/ink-components'
const AnySpinner = Spinner as any

const Step41Introspection: React.FC = () => {
  const router = useContext(RouterContext)
  const [state] = useInitState()
  const { introspect, selectedDatabaseMeta, canConnect, introspecting } = useConnector()

  const { dbCredentials } = state

  if (!dbCredentials) {
    throw new Error(`Can't show the introspection view without db credentials`)
  }

  const dbType = prettyDb(dbCredentials.type)
  const schemaWord = dbCredentials.type === 'mysql' ? 'schema' : 'database'

  const [errorText, setError] = useState('')

  useEffect(() => {
    async function run() {
      if (canConnect && !introspecting) {
        try {
          await introspect(dbCredentials!)
          router.setRoute('tool-selection')
        } catch (e) {
          setError(e.message)
          setTimeout(() => {
            process.exit(1)
          })
        }
      }
    }
    run()
  })

  return (
    <Box flexDirection="column">
      <Box>
        <AnySpinner /> Introspecting {dbType} {schemaWord} <Color bold>{dbCredentials.schema || ''}</Color> with{' '}
        <Color bold>{selectedDatabaseMeta ? selectedDatabaseMeta.tableCount : 0}</Color> tables.
      </Box>
      {errorText && (
        <Box flexDirection="column">
          <ErrorBox>
            <Color bold>Introspection failed:</Color>
          </ErrorBox>
          <Color red>{errorText}</Color>
        </Box>
      )}
    </Box>
  )
}

export default Step41Introspection
