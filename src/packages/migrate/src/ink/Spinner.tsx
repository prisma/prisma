import Debug from 'debug'
import InkSpinner from 'ink-spinner'
import React from 'react'
const debugEnabled = Debug.enabled('lift')

export const Spinner: React.FC<any> = props => (debugEnabled ? <>...</> : <InkSpinner {...props} />)
