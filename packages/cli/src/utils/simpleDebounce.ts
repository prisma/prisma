// makes sure, that there is only one execution at a time
// and the last invocation doesn't get lost (tail behavior of debounce)
// mostly designed for watch mode, where it's fine if something fails, we just try catch it

/* eslint-disable @typescript-eslint/no-explicit-any */
export function simpleDebounce<T extends Function>(fn: T): T {
  let executing = false
  let pendingExecution: any = null
  return (async (...args) => {
    if (executing) {
      // if there are 2 executions 50ms apart, ignore the last one
      pendingExecution = args
      return null as any
    }
    executing = true
    await fn(...args).catch((e) => console.error(e))
    if (pendingExecution) {
      await fn(...pendingExecution).catch((e) => console.error(e))
      pendingExecution = null
    }
    executing = false
  }) as any
}
/* eslint-enable @typescript-eslint/no-explicit-any */
