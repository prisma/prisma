import useGlobalHook from '../utils/useGlobalHook'
import React, { useContext } from 'react'
import { IntrospectionEngine, DatabaseCredentials, getDMMF, dmmfToDml } from '@prisma/sdk'
import { DataSource } from '@prisma/generator-helper'
import { credentialsToUri, databaseTypeToConnectorType } from '@prisma/sdk/src/convertCredentials'
import { TabIndexContext } from '@prisma/ink-components'
import { canConnectToDatabase } from '@prisma/lift'

type ConnectorState = {
  error: string | null
  credentials?: DatabaseCredentials
  introspectionResult?: string
  schemas?: SchemaWithMetaData[]
  canConnect: boolean
  checkingConnection: boolean
  selectedDatabaseMeta?: SchemaWithMetaData
  dbDoesntExist: boolean
  introspecting: boolean
}

const initialState: ConnectorState = {
  error: null,
  canConnect: false,
  checkingConnection: false,
  introspecting: false,
  dbDoesntExist: false,
}

export interface SchemaWithMetaData {
  sizeInBytes: number
  tableCount: number
  name: string
}

export type UseConnector = ConnectorState & ConnectorMethods

export type ConnectorMethods = {
  stopEngine: () => void
  tryToConnect: (credentials: DatabaseCredentials) => void
  introspect: (credentials: DatabaseCredentials) => void
  getMetadata: (credentials: DatabaseCredentials) => void
}

const actions = {
  setState(store, state: Partial<ConnectorState>) {
    store.setState(state)
  },
}
export type ConnectorStore = {
  setState(state: Partial<ConnectorState>): void
}

const useGlobalConnectorState: () => [ConnectorState, ConnectorStore] = useGlobalHook(React, initialState, actions)

function validate(credentials: DatabaseCredentials): string | null {
  if (!credentials.host) {
    return 'Please provide a host'
  }

  if (credentials.type === 'mysql' && !credentials.user) {
    return 'Please provide a user'
  }

  if (credentials.type === 'postgresql' && !credentials.database) {
    return 'Please provide a database'
  }

  return null
}

const engine = new IntrospectionEngine()

export function useConnector(): UseConnector {
  const [state, { setState }] = useGlobalConnectorState()

  const tabContext = useContext(TabIndexContext)

  const tryToConnect = async (credentials: DatabaseCredentials) => {
    const validationError = validate(credentials)
    if (validationError) {
      setState({ error: validationError })
      return
    }
    tabContext.lockNavigation(true)
    setState({ checkingConnection: true })
    try {
      const url = credentialsToUri(credentials)
      const canConnect = await canConnectToDatabase(url)
      if (canConnect === true || canConnect.code === 'P1003') {
        // if we can connect, we always are interested in the metadata

        const dbDoesntExist = typeof canConnect === 'object' && canConnect.code === 'P1003'
        if (!dbDoesntExist) {
          await getMetadata(credentials)
        }

        setState({
          error: null,
          canConnect: true,
          checkingConnection: false,
          dbDoesntExist,
        })
      } else {
        setState({
          error: `${canConnect.code}: ${canConnect.message}`,
          canConnect: false,
          checkingConnection: false,
        })
      }
    } finally {
      tabContext.lockNavigation(false)
    }
  }

  const stopEngine = () => {
    engine.stop()
  }

  const introspect = async (credentials: DatabaseCredentials) => {
    validate(credentials)
    const url = credentialsToUri(credentials)
    try {
      tabContext.lockNavigation(true)

      const schemaName = getSchema(credentials)
      const selectedDatabaseMeta = state.schemas?.find(s => s.name === schemaName)
      setState({ introspecting: true, selectedDatabaseMeta })

      // introspect
      const introspectionSchema = await engine.introspect(url)

      const dmmf = await getDMMF({
        datamodel: introspectionSchema,
      })

      // add the datasource itself to the schema
      const datasources: DataSource[] = [
        {
          name: 'db',
          config: {},
          connectorType: databaseTypeToConnectorType(credentials.type),
          url: {
            value: credentialsToUri(credentials),
            fromEnvVar: null,
          },
        },
      ]

      const schema = await dmmfToDml({
        config: {
          generators: [],
          datasources: datasources,
        },
        dmmf: dmmf.datamodel,
      })

      setState({ introspectionResult: schema, introspecting: false, error: null })
    } finally {
      tabContext.lockNavigation(false)
    }
  }

  const setSchema = (credentials: DatabaseCredentials, schema: string): DatabaseCredentials => {
    if (credentials.type === 'postgresql') {
      return {
        ...credentials,
        schema,
      }
    }

    return {
      ...credentials,
      database: schema,
    }
  }

  const getSchema = (credentials: DatabaseCredentials): string | undefined => {
    if (credentials.type === 'postgresql') {
      return credentials.schema
    }
    return credentials.database
  }

  const getMetadata = async (credentials: DatabaseCredentials) => {
    validate(credentials)
    const url = credentialsToUri(credentials)

    const schemas = await engine.listDatabases(url)

    // const schemas = await connector.connector.listSchemas()
    const schemasWithMetadata: SchemaWithMetaData[] = await Promise.all(
      schemas.map(async name => {
        const credentialsWithSchema = setSchema(credentials, name)
        const urlWithSchema = credentialsToUri(credentialsWithSchema)
        const meta = await engine.getDatabaseMetadata(urlWithSchema)
        return { name, tableCount: meta.table_count, sizeInBytes: meta.size_in_bytes }
      }),
    )

    setState({ schemas: schemasWithMetadata, error: null })
  }

  return {
    tryToConnect,
    stopEngine,
    introspect,
    getMetadata,
    ...state,
  }
}
