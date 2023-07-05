import Debug from '@prisma/debug'

export type BeforeExitListener = () => Promise<void> | void

const debug = Debug('prisma:client:libraryEngine:exitHooks')

// subset of `os.constants.signals`, as we can't import 'os' in Cloudflare Workers
const signals = {
  SIGINT: 2,
  SIGUSR2: 31,
  SIGTERM: 15,
} as const

export class ExitHooks {
  private nextOwnerId = 1
  private ownerToIdMap = new WeakMap<object, number>()
  private idToListenerMap = new Map<number, BeforeExitListener>()
  private areHooksInstalled = false

  install() {
    if (this.areHooksInstalled) {
      return
    }

    this.installExitEventHook('beforeExit')
    this.installExitEventHook('exit')
    this.installExitSignalHook('SIGINT')
    this.installExitSignalHook('SIGUSR2')
    this.installExitSignalHook('SIGTERM')
    this.areHooksInstalled = true
  }

  setListener(owner: object, listener: BeforeExitListener | undefined) {
    if (listener) {
      let id = this.ownerToIdMap.get(owner)
      if (!id) {
        id = this.nextOwnerId++
        this.ownerToIdMap.set(owner, id)
      }
      this.idToListenerMap.set(id, listener)
    } else {
      const id = this.ownerToIdMap.get(owner)
      if (id !== undefined) {
        this.ownerToIdMap.delete(owner)
        this.idToListenerMap.delete(id)
      }
    }
  }

  getListener(owner: object): BeforeExitListener | undefined {
    const id = this.ownerToIdMap.get(owner)
    if (id === undefined) {
      return undefined
    }
    return this.idToListenerMap.get(id)
  }

  private installExitEventHook(event: 'beforeExit' | 'exit') {
    // Note: TypeScript isn't able to narrow type arguments on overloaded functions.
    process.once(event as any, this.exitLikeHook)
  }

  private installExitSignalHook(signal: keyof typeof signals) {
    process.once(signal, async (signal) => {
      await this.exitLikeHook(signal)
      const isSomeoneStillListening = process.listenerCount(signal) > 0

      // Only exit when there are no listeners left for this signal.
      // If there is another listener, that other listener is responsible for exiting.
      if (isSomeoneStillListening) {
        return
      }

      // the usual way to exit with a signal is to add 128 to the signal number
      const exitCode = signals[signal] + 128
      process.exit(exitCode)
    })
  }

  private exitLikeHook = async (event: 'beforeExit' | 'exit' | NodeJS.Signals) => {
    debug(`exit event received: ${event}`)
    for (const listener of this.idToListenerMap.values()) {
      await listener()
    }

    this.idToListenerMap.clear()
  }
}
