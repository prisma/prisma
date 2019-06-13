import React from 'react'
import { render, Instance } from 'ink'
import { DevInkComponent, DevComponentProps, GeneratorInfo } from './DevInkComponent'

export type DevComponentOptions = {
  port: number
  initialState: DevComponentProps
}

export class DevComponentRenderer {
  state: DevComponentProps
  app: Instance
  constructor(options: DevComponentOptions) {
    this.state = options.initialState
    this.app = this.render()
    process.on('SIGINT', () => {
      this.app.unmount()
    })
  }
  // setState for nested array
  setGeneratorState(index: number, gen: Partial<GeneratorInfo>) {
    this.state.generators[index] = { ...this.state.generators[index], ...gen }
    this.render()
  }
  setState(state: Partial<DevComponentProps>) {
    this.state = { ...this.state, ...state }
    this.render()
  }
  render() {
    if (!this.app) {
      return render(<DevInkComponent {...this.state} />)
    }

    this.app.rerender(<DevInkComponent {...this.state} />)

    return this.app
  }
}
