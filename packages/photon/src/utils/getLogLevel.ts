type LogLevel = 'info' | 'query' | 'warn'
type LogDefinition = {
  level: LogLevel
  emit: 'stdout' | 'event'
}

export function getLogLevel(
  log: Array<LogLevel | LogDefinition>,
): LogLevel | undefined {
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
