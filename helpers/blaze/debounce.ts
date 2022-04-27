/**
 * Makes that a function is only executed after repeated calls (usually
 * excessive calls) stop for a defined amount of {@link time}.
 * @param fn to debounce
 * @param time to unlock
 * @returns
 */
function debounce<P extends any[], R>(fn: (...args: P) => R, time: number) {
  let timeoutId: number | NodeJS.Timeout | undefined

  return (...args: P): void => {
    clearTimeout(timeoutId as NodeJS.Timeout)

    timeoutId = setTimeout(() => fn(...args), time)
  }
}

export { debounce }
