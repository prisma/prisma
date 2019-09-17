import { DatabaseCredentials } from '../../types'
import { IConnector } from 'prisma-db-introspection'
import useGlobalHook from '../utils/useGlobalHook'
import React, { useContext } from 'react'
import { ConnectorAndDisconnect, getConnectedConnectorFromCredentials } from '../../introspectionConnector'
import { DatabaseType } from 'prisma-datamodel'
import { DataSource, isdlToDatamodel2 } from '@prisma/photon'
import { credentialsToUri, databaseTypeToConnectorType } from '../../convertCredentials'
import { TabIndexContext } from './TabIndex'

type ConnectorState = {
  error: string | null
  credentials?: DatabaseCredentials
  introspectionResult?: string
  schemas?: SchemaWithMetaData[]
  connected: boolean
  connecting: boolean
  selectedDatabaseMeta?: SchemaWithMetaData
  dbDoesntExist: boolean
}

const initialState: ConnectorState = {
  error: null,
  connected: false,
  connecting: false,
  dbDoesntExist: false,
}

export interface SchemaWithMetaData {
  sizeInBytes: number
  countOfTables: number
  name: string
}

export type UseConnector = {
  connector: IConnector | null
  error: Error | null
  introspectionResult?: string
  schemas?: SchemaWithMetaData[]
  connect: (credentials: DatabaseCredentials) => void
  disconnect: () => void
  introspect: (database: string) => void
  getMetaData: () => void
}

const actions = {
  setState(store, state: Partial<ConnectorState>) {
    store.setState(state)
  },
  setConnector(store, connector: ConnectorAndDisconnect) {
    store.setShallowState({ connector })
  },
}
export type ConnectorStore = {
  setState(state: Partial<ConnectorState>): void
  setConnector(connector: ConnectorAndDisconnect): void
}

const useGlobalConnectorState: () => [ConnectorState, ConnectorStore] = useGlobalHook(React, initialState, actions)

let connector: ConnectorAndDisconnect | null = null

export function useConnector() {
  const [state, { setState, setConnector }] = useGlobalConnectorState()

  const tabContext = useContext(TabIndexContext)

  const validate = (credentials: DatabaseCredentials): string | null => {
    if (!credentials.host) {
      return 'Please provide a host'
    }

    if (credentials.type === DatabaseType.mysql && !credentials.user) {
      return 'Please provide a user'
    }

    if (credentials.type === DatabaseType.postgres && !credentials.database) {
      return 'Please provide a database'
    }

    return null
  }

  const connect = async (credentials: DatabaseCredentials) => {
    const validationError = validate(credentials)
    if (validationError) {
      setState({ error: validationError })
      return
    }
    if (!connector) {
      try {
        tabContext.lockNavigation(true)
        setState({ connecting: true })
        const connectorAndDisconnect = await getConnectedConnectorFromCredentials(credentials)
        connector = connectorAndDisconnect
        await getMetadata()

        let meta
        const schema = credentials.type === DatabaseType.postgres ? credentials.schema : credentials.database
        if (schema) {
          meta = await connector.connector.getMetadata(schema)
        }

        setState({
          credentials,
          connected: true,
          connecting: false,
          selectedDatabaseMeta: { ...meta, name: credentials.database },
        })
        tabContext.lockNavigation(false)
      } catch (error) {
        if (error.message.includes('Unknown database') && (credentials.database || credentials.schema)) {
          const credentialsCopy = {
            ...credentials,
            database: undefined,
            schema: undefined,
          }
          return connect(credentialsCopy)
        } else {
          setState({ error: prettifyConnectorError(error), connecting: false })
          tabContext.lockNavigation(false)
        }
      }
    } else {
      await connector.disconnect()
      connector = null
      await connect(credentials)
    }
  }

  const disconnect = async () => {
    if (connector) {
      await connector.disconnect()
      setState({ connected: false })
      connector = null
    }
  }

  const introspect = async (databaseName: string) => {
    if (!connector) {
      throw new Error(`Can't introspect before connecting`)
    }
    if (!state.credentials) {
      throw new Error(`Can't introspect without credentials`)
    }
    const { credentials } = state
    const introspection = await connector.connector.introspect(databaseName) // TODO: check if it's called schema or database for mysql
    const sdl = await introspection.getNormalizedDatamodel()

    if (credentials.type === DatabaseType.postgres && !credentials.schema) {
      credentials.schema = databaseName
    }

    const dataSources: DataSource[] = [
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

    const renderedSdl = await isdlToDatamodel2(sdl, dataSources)
    setState({ introspectionResult: renderedSdl })
  }

  const getMetadata = async () => {
    if (!connector) {
      throw new Error(`Can't get metadata without connector`)
    }

    const schemas = await connector.connector.listSchemas()
    const schemasWithMetadata = await Promise.all(
      schemas.map(async name => ({ name, ...(await connector!.connector.getMetadata(name)) })),
    )

    setState({ schemas: schemasWithMetadata })
  }

  return {
    connect,
    disconnect,
    connector,
    introspect,
    schemas: state.schemas,
    introspectionResult: state.introspectionResult,
    connected: state.connected,
    connecting: state.connecting,
    error: state.error,
    selectedDatabaseMeta: state.selectedDatabaseMeta, // TODO: just use ...state
    getMetadata,
  }
}

/**
 * Known error codes:
 * ER_NOT_SUPPORTED_AUTH_MODE -> provide a user!
 * ER_ACCESS_DENIED_ERROR
 */

export function prettifyConnectorError(error: any): string {
  if (error instanceof Error) {
    if (process.env.DEBUG === '*') {
      return error.stack || error.message
    }
    return error.message
  }

  if (error && typeof error === 'object') {
    if (error.code && error.sqlMessage) {
      return `${error.code}: ${error.sqlMessage}`
    }
  }

  return String(error)
}
