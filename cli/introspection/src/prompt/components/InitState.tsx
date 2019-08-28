import React from 'react'
import useGlobalHook from '../utils/useGlobalHook'
import { Example } from '../types'
import { DatabaseCredentials } from '../../types'
import { uriToCredentials, credentialsToUri } from '../../convertCredentials'

export type DBType = 'postgres' | 'sqlite' | 'mysql'
export type Language = 'typescript' | 'javascript'

export type InitState = {
  selectedDb?: DBType
  selectedLanguage?: Language
  selectedExample?: Example
  useBlank: boolean
  usePhoton: boolean
  useLift: boolean
  useDemoScript?: boolean
  dbCredentials?: DatabaseCredentials
  outputDir: string
}

const initialState: InitState = {
  usePhoton: true,
  useLift: true,
  outputDir: process.cwd(),
  useBlank: false,
  useDemoScript: false,
}

const actions = {
  setState(store, state) {
    store.setState(state)
  },
  setDbCredentials(store, dbCredentials: Partial<DatabaseCredentials>) {
    if (Object.keys(dbCredentials).length === 1 && dbCredentials.type) {
      store.setState({ dbCredentials })
    } else if (dbCredentials.uri) {
      const credentials = uriToCredentials(dbCredentials.uri)
      store.setState({ dbCredentials: { uri: dbCredentials.uri, ...credentials } })
    } else {
      const merged = { ...store.state.dbCredentials, ...dbCredentials }
      const uri = credentialsToUri(merged)
      store.setState({ dbCredentials: { ...merged, uri } })
    }
  },
}

export type InitStore = {
  setState(state: Partial<InitState>): void
  setDbCredentials(state: Partial<DatabaseCredentials>): void
}

export type UseInitState = () => [InitState, InitStore]

export const useInitState: UseInitState = useGlobalHook(React, initialState, actions)
