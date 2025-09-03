import { Options } from '../options.ts'
import { App } from '../logic/app.ts'

/**
 * Shared state for the server.
 */
export type State = {
  readonly app: App
  readonly options: Options
}

/**
 * Connects to the database and initializes the shared state.
 */
export async function connect(options: Options): Promise<State> {
  return {
    app: await App.start(options),
    options,
  }
}
