import paths from 'env-paths'
import fs from 'fs'
import path from 'path'

export interface CommandState {
  firstCommandTimestamp: string
}

function getCommandStatePath(): string {
  return path.join(paths('prisma').config, 'commands.json')
}

/*
 * Loads the command state from a file, or initializes it if it doesn't exist.
 * The command state contains the timestamp of the first command issued.
 */
export async function loadOrInitializeCommandState(): Promise<CommandState> {
  const filePath = getCommandStatePath()
  const data = await fs.promises
    .readFile(filePath, 'utf-8')
    .catch((err) => (err.code === 'ENOENT' ? Promise.resolve(undefined) : Promise.reject(err)))
  const state = data === undefined ? { firstCommandTimestamp: new Date().toISOString() } : JSON.parse(data)

  if (data === undefined) {
    await fs.promises.writeFile(filePath, JSON.stringify(state))
  }

  if (typeof state.firstCommandTimestamp === 'string') {
    return state
  } else {
    throw new Error('Invalid command state schema')
  }
}

/*
 * Calculates the number of days since the first command was issued.
 */
export function daysSinceFirstCommand(state: CommandState, now: Date = new Date()): number {
  const firstCommandDate = new Date(state.firstCommandTimestamp)
  const diffTime = now.getTime() - firstCommandDate.getTime()
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}
