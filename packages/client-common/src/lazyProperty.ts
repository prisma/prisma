export type LazyProperty<T> = {
  get: () => T
}

export function lazyProperty<T>(compute: () => T): LazyProperty<T> {
  let resultContainer: undefined | { value: T }

  return {
    get() {
      if (resultContainer) {
        return resultContainer.value
      }
      resultContainer = { value: compute() }
      return resultContainer.value
    },
  }
}
