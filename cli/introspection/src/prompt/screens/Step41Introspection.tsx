import React, { useEffect, useState, useContext } from 'react'
import { Box, Color } from 'ink'
import { useInitState } from '../components/InitState'
import Spinner from 'ink-spinner'
import { DatabaseType } from 'prisma-datamodel'
import { useConnector } from '../components/useConnector'
import { RouterContext } from '../components/Router'
import { prettyDb } from '../utils/print'
const AnySpinner = Spinner as any

const Step41Introspection: React.FC = () => {
  const router = useContext(RouterContext)
  const [state] = useInitState()
  const { connector, introspect } = useConnector()
  const [tableCount, setTableCount] = useState(0)

  const sqliteHref = state.useBlank ? 'tool-selection' : 'download-example'

  const { dbCredentials } = state

  if (!dbCredentials) {
    throw new Error(`Can't show the introspection view without db credentials`)
  }

  const dbType = prettyDb(dbCredentials.type)
  const schemaWord = dbCredentials.type === DatabaseType.mysql ? 'schema' : 'database'

  useEffect(() => {
    async function run() {
      if (connector) {
        const db = dbCredentials!.type === DatabaseType.postgres ? dbCredentials!.schema : dbCredentials!.database
        const result = await connector.connector.getMetadata(db!)
        setTableCount(result.countOfTables)
        await introspect(db!)
        router.setRoute('tool-selection')
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
        <Color bold>{tableCount || 0}</Color> tables.
      </Box>
    </Box>
  )
}

export default Step41Introspection
