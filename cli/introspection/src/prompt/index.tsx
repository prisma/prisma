import { render } from 'ink'
import * as React from 'react'
import { ConnectorData } from '../introspect/util'
import { InitPromptResult, IntrospectionResult, PromptType } from '../types'
import { InteractivePrompt } from './InteractivePrompt'

export async function promptInteractively(
  introspectFn: (connector: ConnectorData) => Promise<IntrospectionResult>,
  type: 'init',
): Promise<InitPromptResult>
export async function promptInteractively(
  introspectFn: (connector: ConnectorData) => Promise<IntrospectionResult>,
  type: 'introspect',
): Promise<IntrospectionResult>
export async function promptInteractively(
  introspectFn: (connector: ConnectorData) => Promise<IntrospectionResult>,
  type: PromptType,
): Promise<IntrospectionResult | InitPromptResult> {
  return new Promise(async resolve => {
    render(<InteractivePrompt introspect={introspectFn} type={type} onSubmit={resolve} />)
  })
}
