export function formatms(ms: number) {
  if (ms < 1000) {
    return `${ms}ms`
  }

  return (ms / 1000).toFixed(2) + 's'
}
