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
  pid: 10000,
}

export const { cwd } = process
export default process
