import * as React from 'react'
import { Prompt } from '../../prompt-lib/BoxPrompt'
import { ActionType } from '../reducer'
import { formByStep, Step } from '../steps-definition'

export function renderSelectLanguage(dispatch: React.Dispatch<ActionType>) {
  return (
    <Prompt
      key={Step.SELECT_LANGUAGE}
      title="Which parts of Prisma do you want to use?"
      subtitle="Learn more about the tools at prisma.io/docs"
      elements={formByStep[Step.SELECT_LANGUAGE]()}
      formValues={{}}
      withBackButton={{
        label: 'Back',
        description: '(Tool selection)',
      }}
      onSubmit={params => {
        if (params.goBack) {
          return dispatch({ type: 'back' })
        }
        dispatch({ type: 'set_language', payload: { language: params.selectedValue } })
      }}
    />
  )
}
