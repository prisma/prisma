import { DatabaseType } from 'prisma-datamodel'
import { DatabaseMetadata } from 'prisma-db-introspection/dist/common/introspectionResult'
import { ConnectorAndDisconnect } from '../introspect/util'
import { DatabaseCredentials, IntrospectionResult } from '../types'
import { PromptState } from './InteractivePrompt'

export type ActionChooseDB = {
  type: 'choose_db'
  payload: DatabaseType
}

export type ActionConnect = {
  type: 'connect_db'
  payload: {
    credentials: DatabaseCredentials
    schemas: { name: string; metadata: DatabaseMetadata }[]
    connectorAndDisconnect: ConnectorAndDisconnect
  }
}

export type ActionBack = {
  type: 'back'
}

export type ActionSetCredentials = {
  type: 'set_credentials'
  payload: {
    credentials: DatabaseCredentials
  }
}

export type ActionSetTools = {
  type: 'set_tools'
  payload: {
    lift: boolean
    photon: boolean
  }
}

export type ActionSetLanguage = {
  type: 'set_language'
  payload: {
    language: PromptState['language']
  }
}

export type ActionSetTemplate = {
  type: 'set_template'
  payload: {
    template: PromptState['template']
  }
}

export type ActionForward = {
  type: 'forward'
}

export type ActionSetIntrospectionResult = {
  type: 'set_introspection_result'
  payload: {
    introspectionResult: IntrospectionResult
  }
}

export type ActionType =
  | ActionChooseDB
  | ActionConnect
  | ActionBack
  | ActionSetCredentials
  | ActionSetTools
  | ActionForward
  | ActionSetLanguage
  | ActionSetTemplate
  | ActionSetIntrospectionResult

export const promptReducer: React.Reducer<PromptState, ActionType> = (state, action): PromptState => {
  switch (action.type) {
    case 'choose_db':
      return {
        ...state,
        stepCursor: state.stepCursor + 1,
        credentials: {
          ...state.credentials,
          type: action.payload,
        },
        databaseType: action.payload,
      }
    case 'connect_db':
      return {
        ...state,
        stepCursor: state.stepCursor + 1,
        credentials: {
          ...state.credentials,
          ...action.payload.credentials,
        },
        schemas: action.payload.schemas,
        connectorData: action.payload.connectorAndDisconnect,
      }
    case 'back':
      if (state.stepCursor === 0) {
        return state
      }

      return {
        ...state,
        stepCursor: state.stepCursor - 1,
      }
    case 'forward':
      return {
        ...state,
        stepCursor: state.stepCursor + 1,
      }
    case 'set_credentials':
      return {
        ...state,
        credentials: {
          ...state.credentials,
          ...action.payload.credentials,
        },
      }
    case 'set_introspection_result':
      return {
        ...state,
        introspectionResult: action.payload.introspectionResult,
        stepCursor: state.stepCursor + 1,
      }
    case 'set_tools':
      return {
        ...state,
        lift: action.payload.lift,
        photon: action.payload.photon,
      }
    case 'set_language':
      return {
        ...state,
        ...action.payload,
        stepCursor: state.stepCursor + 1,
      }
    case 'set_template':
      return {
        ...state,
        template: action.payload.template,
      }
  }
}
