type Listener = (...args: any[]) => void

export class EventEmitter {
  private events: Record<string, Listener[]> = {}

  on(event: string, listener: Listener) {
    if (!this.events[event]) {
      this.events[event] = []
    }

    this.events[event].push(listener)

    return this
  }

  emit(event: string, ...args: any[]) {
    if (!this.events[event]) {
      return false
    }

    this.events[event].forEach((listener) => {
      listener(...args)
    })

    return true
  }
}

/**
 * A poor man's shim for the "events" module
 */
const events = {
  EventEmitter,
}

export default events
