import { DatabaseType } from 'prisma-datamodel'
import * as React from 'react'
import { ConnectorData } from '../introspect/util'
import {
  DatabaseCredentials,
  InitConfiguration,
  InitPromptResult,
  IntrospectionResult,
  PromptType,
  SchemaWithMetadata,
} from '../types'
import { dbTypeToDbPort } from './prompts-elements'
import { ActionType, promptReducer } from './reducer'
import {
  renderInputDatabaseCredentials,
  renderSelectDatabaseSchema,
  renderSelectDatabaseType,
  renderSelectLanguage,
  renderSelectTemplate,
  renderSelectTool,
} from './steps'
import { Step, stepsByDatabaseType } from './steps-definition'

export interface PromptProps {
  onSubmit: (introspectionResult: IntrospectionResult | InitPromptResult) => void
  introspect: (connector: ConnectorData) => Promise<IntrospectionResult>
  type: PromptType
}

export type PromptState = {
  stepCursor: number
  credentials: Partial<DatabaseCredentials>
  connectorData: Partial<ConnectorData>
  introspectionResult: IntrospectionResult | null
  schemas: SchemaWithMetadata[]
} & InitConfiguration

const initialState: PromptState & InitConfiguration = {
  stepCursor: 0,
  credentials: {},
  connectorData: {},
  schemas: [],
  introspectionResult: null,
  lift: false,
  photon: false,
  language: 'TypeScript',
  template: 'from_scratch',
  databaseType: DatabaseType.sqlite,
}

export const dbTypeTodbName: Record<DatabaseType, string> = {
  [DatabaseType.postgres]: 'Postgres',
  [DatabaseType.mysql]: 'MySQL',
  [DatabaseType.mongo]: 'MongoDB',
  [DatabaseType.sqlite]: 'SQLite',
}

export const defaultCredentials = (dbType: DatabaseType): DatabaseCredentials => ({
  host: 'localhost',
  port: parseInt(dbTypeToDbPort[dbType], 10),
  type: dbType,
})

/**
 * WARNING: If you add more steps, make sure to add a `key` to the `<Prompt />`, otherwise the state between each prompt will be shared
 */
export const InteractivePrompt: React.FC<PromptProps> = props => {
  const [state, dispatch] = React.useReducer<React.Reducer<PromptState, ActionType>>(promptReducer, initialState)

  if (state.stepCursor === 0) {
    return renderSelectDatabaseType(dispatch, state)
  }

  const currentStep = stepsByDatabaseType[state.databaseType][state.stepCursor]

  switch (currentStep) {
    case Step.INPUT_DATABASE_CREDENTIALS:
      return renderInputDatabaseCredentials(dispatch, state)
    case Step.SELECT_DATABASE_SCHEMA:
      return renderSelectDatabaseSchema(dispatch, state, props)
    case Step.SELECT_TOOL:
      return renderSelectTool(dispatch, state)
    case Step.SELECT_LANGUAGE:
      return renderSelectLanguage(dispatch)
    case Step.SELECT_TEMPLATE:
      return renderSelectTemplate(dispatch, state, props)
    default:
      return renderSelectDatabaseType(dispatch, state)
  }
}
