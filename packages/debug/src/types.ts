export interface Debug {
  (namespace: string): Debugger
  disable: () => string
  enable: (namespace: string) => void
  enabled: (namespace: string) => boolean
  log: (...args: any[]) => any
  formatters: Record<string, ((value: any) => string) | undefined>
}

export interface Debugger {
  (format: any, ...args: any[]): void
  log: (...args: any[]) => any
  extend: (namespace: string, delimiter?: string) => Debugger
  color: string | number
  enabled: boolean
  namespace: string
}
