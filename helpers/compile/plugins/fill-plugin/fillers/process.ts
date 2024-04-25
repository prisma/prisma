export const process: Partial<NodeJS.Process> = {
  nextTick: (fn: Function, ...args: unknown[]) => {
    setTimeout(() => {
      fn(...args)
    }, 0)
  },
  env: {},
  version: '',
  cwd: () => '/',
  stderr: {} as any,
  argv: ['/bin/node'],
}
