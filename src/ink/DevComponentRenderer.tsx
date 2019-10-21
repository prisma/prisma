import { Instance, render } from 'ink'
import React from 'react'
import { EngineResults } from '../types'
import { exit } from '../utils/exit'
import { DevComponentProps, DevInkComponent, GeneratorInfo } from './DevInkComponent'

export interface DevComponentOptions {
  port: number
  initialState: DevComponentProps
}

export class DevComponentRenderer {
  public state: DevComponentProps
  public app?: Instance
  public count: number = 0
  public lastNewState?: any
  private warningsPromptCallback?: (ok: boolean) => void
  constructor(options: DevComponentOptions) {
    this.state = options.initialState
    this.app = this.render()
    process.on('SIGINT', () => {
      if (this.app) {
        this.app.unmount()
      }
    })
  }
  // setState for nested array
  public setGeneratorState(index: number, gen: Partial<GeneratorInfo>) {
    this.state.generators[index] = { ...this.state.generators[index], ...gen }
    this.render()
  }
  public setState(state: Partial<DevComponentProps>) {
    this.lastNewState = state
    this.state = { ...this.state, ...state }
    this.render()
  }
  public promptForWarnings(warnings: EngineResults.Warning[]): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.warningsPromptCallback = async ok => {
        if (!ok) {
          await exit()
        } else {
          this.setState({ warnings: [] })
          resolve(ok)
        }
      }
      this.setState({ warnings })
    })
  }
  public render() {
    if (!this.app) {
      return render(<DevInkComponent {...this.state} onSubmitWarningsPrompt={this.warningsPromptCallback} />)
    }
    this.app.rerender(<DevInkComponent {...this.state} onSubmitWarningsPrompt={this.warningsPromptCallback} />)

    return this.app
  }
}
