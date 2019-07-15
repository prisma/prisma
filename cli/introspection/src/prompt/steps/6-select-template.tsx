import * as React from 'react'
import { Prompt } from '../../prompt-lib/BoxPrompt'
import { InitPromptResult } from '../../types'
import { PromptProps, PromptState } from '../InteractivePrompt'
import { ActionType } from '../reducer'
import { Step, formByStep } from '../steps-definition'

export function renderSelectTemplate(
  dispatch: React.Dispatch<ActionType>,
  state: PromptState,
  props: React.PropsWithChildren<PromptProps>,
) {
  return (
    <Prompt
      key={Step.SELECT_TEMPLATE}
      title="Which parts of Prisma do you want to use?"
      subtitle="Learn more about the tools at prisma.io/docs"
      elements={formByStep[Step.SELECT_TEMPLATE]()}
      formValues={{}}
      withBackButton={{
        label: 'Back',
        description: '(Language selection)',
      }}
      onSubmit={params => {
        if (params.goBack) {
          return dispatch({ type: 'back' })
        }
        const selectedTemplate = params.selectedValue

        // /!\ Disconnect the connector before quiting the prompt. This should probably be done in the `promptInteractively` method
        if (state.connectorData && state.connectorData.disconnect) {
          state.connectorData.disconnect!()
        }

        props.onSubmit({
          introspectionResult: state.introspectionResult,
          initConfiguration: {
            language: state.language,
            lift: state.lift,
            photon: state.photon,
            template: selectedTemplate,
            databaseType: state.databaseType
          },
        } as InitPromptResult)
      }}
    />
  )
}
