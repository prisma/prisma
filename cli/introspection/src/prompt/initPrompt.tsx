import { render } from 'ink'
import React from 'react'
import { Root } from './Root'

export async function initPrompt(outputDir: string) {
  return new Promise(resolve => {
    render(<Root outputDir={outputDir} />)
  })
}
