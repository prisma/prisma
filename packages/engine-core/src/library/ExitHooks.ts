import Debug from '@prisma/debug'

export type BeforeExitListener = () => Promise<void> | void

const debug = Debug('prisma:client:libraryEngine:exitHooks')

export class ExitHooks {
  private nextOwnerId = 1
  private ownerToIdMap = new WeakMap<object, number>()
  private idToListenerMap = new Map<number, BeforeExitListener>()
  private areHooksInstalled = false

  install() {
    if (this.areHooksInstalled) {
      return
    }

    this.installHook('beforeExit')
    this.installHook('exit')
    this.installHook('SIGINT', true)
    this.installHook('SIGUSR2', true)
    this.installHook('SIGTERM', true)
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

  private installHook(event: string, shouldExit = false) {
    process.once(event, async (code) => {
      debug(`exit event received: ${event}`)
      for (const listener of this.idToListenerMap.values()) {
        await listener()
      }

      this.idToListenerMap.clear()

      // only exit, if only we are listening
      // if there is another listener, that other listener is responsible
      if (shouldExit && process.listenerCount(event) === 0) {
        process.exit(code)
      }
    })
  }
}
