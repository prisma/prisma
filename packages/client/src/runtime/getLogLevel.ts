type LogLevel = 'info' | 'query' | 'warn' | 'error'
type LogDefinition = {
  level: LogLevel
  emit: 'stdout' | 'event'
}

export function getLogLevel(log: LogLevel | Array<LogLevel | LogDefinition>): LogLevel | undefined {
  if (typeof log === 'string') {
    return log
  }
  return log.reduce<LogLevel | undefined>((acc, curr) => {
    const currentLevel = typeof curr === 'string' ? curr : curr.level
    if (currentLevel === 'query') {
      return acc
    }
    if (!acc) {
      return currentLevel
    }
    if (curr === 'info' || acc === 'info') {
      // info has precedence
      return 'info'
    }
    return currentLevel
  }, undefined)
}
