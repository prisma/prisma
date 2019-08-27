import React from 'react'
import useGlobalHook from '../utils/useGlobalHook'
import { Example } from '../types'
import { DatabaseCredentials } from '../../types'

export type DBType = 'postgres' | 'sqlite' | 'mysql'
export type Language = 'typescript' | 'javascript'

export type InitState = {
  selectedDb?: 'postgres' | 'sqlite' | 'mysql'
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
}

export type InitStore = {
  setState(state: Partial<InitState>): void
}

export type UseInitState = () => [InitState, InitStore]

export const useInitState: UseInitState = useGlobalHook(React, initialState, actions)
