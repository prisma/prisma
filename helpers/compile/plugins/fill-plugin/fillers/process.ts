export const process: Partial<NodeJS.Process> = {
  nextTick: (fn: (...args: unknown[]) => unknown, ...args: unknown[]) => {
    setTimeout(() => {
      fn(...args)
    }, 0)
  },
  env: {},
  version: '',
  cwd: () => '/',
  stderr: {} as NodeJS.Process['stderr'],
  argv: ['/bin/node'],
}
