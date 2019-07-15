import chalk from 'chalk'
import { Box, Color } from 'ink'
import * as React from 'react'
import { credentialsToUri } from '../../convertCredentials'
import { ConnectorData, minimalPrettyTime } from '../../introspect/util'
import { OnSubmitParams, Prompt } from '../../prompt-lib/BoxPrompt'
import { DatabaseCredentials } from '../../types'
import { defaultCredentials, PromptProps, PromptState } from '../InteractivePrompt'
import { ActionType } from '../reducer'
import { formByStep, Step } from '../steps-definition'

import figures = require('figures')

export function renderSelectDatabaseSchema(
  dispatch: React.Dispatch<ActionType>,
  state: PromptState,
  props: React.PropsWithChildren<PromptProps>,
) {
  return (
    <Box flexDirection="column">
      <Color green>{figures.tick} Connected to database</Color>
      <Prompt
        key={Step.SELECT_DATABASE_SCHEMA}
        title="Select the schema you want to introspect"
        formValues={state.credentials}
        elements={formByStep[Step.SELECT_DATABASE_SCHEMA](state.schemas)}
        onFormChanged={({ values, triggeredInput }) => {
          // Select only one or the other
          if (triggeredInput.identifier === 'schema') {
            values['newSchema'] = ''
          }
          if (triggeredInput.identifier === 'newSchema') {
            values['schema'] = ''
          }
          dispatch({ type: 'set_credentials', payload: { credentials: values as DatabaseCredentials } })
        }}
        onSubmit={onSelectSchema(dispatch, state, props)}
        withBackButton={{
          label: 'Back',
          description: '(Database credentials)',
        }}
      />
    </Box>
  )
}

function replaceSchemaByNewSchema(credentials: DatabaseCredentials): DatabaseCredentials {
  if (credentials.newSchema) {
    return {
      ...credentials,
      schema: credentials.newSchema,
    }
  }

  return credentials
}

function onSelectSchema(
  dispatch: React.Dispatch<ActionType>,
  state: PromptState,
  props: React.PropsWithChildren<PromptProps>,
): (params: OnSubmitParams) => void {
  return async ({ goBack, startSpinner, stopSpinner }) => {
    if (goBack) {
      return dispatch({ type: 'back' })
    }

    const selectedSchema = state.credentials.newSchema ? state.credentials.newSchema : state.credentials.schema

    if (!state.credentials.schema && !state.credentials.newSchema) {
      stopSpinner({ state: 'failed', message: 'Please select a schema' })
      return
    }

    try {
      const before = Date.now()
      startSpinner(`Introspecting ${selectedSchema!}`)
      const credsWithNewSchemaReplaced = replaceSchemaByNewSchema(state.credentials as DatabaseCredentials)
      const credsWithDefaultCredentials = {
        ...defaultCredentials(state.credentials.type!),
        ...credsWithNewSchemaReplaced,
      }
      const introspectionResult = await props.introspect({
        ...state.connectorData,
        databaseName: selectedSchema,
        credentials: { ...credsWithDefaultCredentials, uri: credentialsToUri(credsWithDefaultCredentials) },
      } as ConnectorData)

      stopSpinner({
        state: 'succeeded',
        message: `Introspecting ${selectedSchema!} ${chalk.bold(minimalPrettyTime(Date.now() - before))}`,
      })

      // /!\ Disconnect the connector before quiting the prompt. This should probably be done in the `promptInteractively` method
      await state.connectorData.disconnect!()
      return props.onSubmit({ introspectionResult, initConfiguration: {} as any })
    } catch (e) {
      stopSpinner({ state: 'failed', message: e.message })
    }
  }
}
