import * as React from 'react'
import { Prompt } from '../../prompt-lib/BoxPrompt'
import { PromptState } from '../InteractivePrompt'
import { ActionType } from '../reducer'
import { formByStep, Step } from '../steps-definition'

export function renderSelectDatabaseType(dispatch: React.Dispatch<ActionType>, state: PromptState) {
  return (
    <Prompt
      key={Step.SELECT_DATABASE_TYPE}
      title="What kind of database do you want to introspect?"
      elements={formByStep[Step.SELECT_DATABASE_TYPE]()}
      onSubmit={({ selectedValue }) => {
        dispatch({
          type: 'choose_db',
          payload: selectedValue,
        })
      }}
      formValues={state.credentials}
      withBackButton={false}
    />
  )
}
