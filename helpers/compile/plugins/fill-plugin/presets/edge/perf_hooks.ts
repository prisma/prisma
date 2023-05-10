const performance =
  globalThis['performance'] ??
  (() => {
    const origin = Date.now()
    return {
      now: () => Date.now() - origin,
    }
  })()

export { performance }
export default { performance }
