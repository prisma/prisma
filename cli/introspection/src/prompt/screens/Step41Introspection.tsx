import React, { useEffect, useState, useContext } from 'react'
import { Box, Color } from 'ink'
import { useInitState } from '../components/InitState'
import Spinner from 'ink-spinner'
import { DatabaseType } from 'prisma-datamodel'
import { useConnector, prettifyConnectorError } from '../components/useConnector'
import { RouterContext } from '../components/Router'
import { prettyDb } from '../utils/print'
import { ErrorBox } from '../components/ErrorBox'
const AnySpinner = Spinner as any

const Step41Introspection: React.FC = () => {
  const router = useContext(RouterContext)
  const [state] = useInitState()
  const { connector, introspect, selectedDatabaseMeta } = useConnector()

  const { dbCredentials } = state

  if (!dbCredentials) {
    throw new Error(`Can't show the introspection view without db credentials`)
  }

  const dbType = prettyDb(dbCredentials.type)
  const schemaWord = dbCredentials.type === DatabaseType.mysql ? 'schema' : 'database'

  const [errorText, setError] = useState('')

  useEffect(() => {
    async function run() {
      if (connector) {
        const db = dbCredentials!.type === DatabaseType.postgres ? dbCredentials!.schema : dbCredentials!.database
        try {
          await introspect(db!)
          router.setRoute('tool-selection')
        } catch (e) {
          setError(prettifyConnectorError(e))
          setTimeout(() => {
            process.exit(1)
          })
        }
      } else {
        throw new Error(`Connector instance not present. Can't introspect.`)
      }
    }
    run()
  })

  return (
    <Box flexDirection="column">
      <Box>
        <AnySpinner /> Introspecting {dbType} {schemaWord} <Color bold>{dbCredentials.schema || ''}</Color> with{' '}
        <Color bold>{selectedDatabaseMeta ? selectedDatabaseMeta.countOfTables : 0} </Color> tables.
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
