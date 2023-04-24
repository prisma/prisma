import Debug from '@prisma/debug'
import os from 'os'

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

  private installHook(event: 'beforeExit' | 'exit' | NodeJS.Signals, shouldExit = false) {
    const exitLikeHook = async (exitCode: number) => {
      debug(`exit event received: ${event}`)
      for (const listener of this.idToListenerMap.values()) {
        await listener()
      }

      this.idToListenerMap.clear()

      // only exit, if only we are listening
      // if there is another listener, that other listener is responsible
      if (shouldExit && process.listenerCount(event) === 0) {
        process.exit(exitCode)
      }
    }

    /**
     * Register `exitLikeHook` as a listener for the given event.
     */
    if (isSignal(event)) {
      process.once(event, async (signal) => {
        // the usual way to exit with a signal is to add 128 to the signal number
        const exitCode = os.constants.signals[signal] + 128
        await exitLikeHook(exitCode)
      })
    } else {
      // Note: TypeScript isn't able to narrow type arguments on overloaded functions.
      process.once(event as any, exitLikeHook)
    }
  }
}

function isSignal<EventName extends string, SignalLike extends Capitalize<string>>(
  eventOrSignal: NodeJS.Signals | EventName,
): eventOrSignal is SignalLike & NodeJS.Signals {
  // Here's a quick way of checking if the given argument is a signal, as the signal names are all uppercase,
  // whereas the other events are in camelCase, so they start with a lowercase letter.
  // The alternative would be comparing the event against `Object.keys(os.constants.signals)` (or a Set thereof),
  // which would be slower and require more memory allocations.
  const firstChar = eventOrSignal[0]
  return firstChar.toUpperCase() === firstChar
}
