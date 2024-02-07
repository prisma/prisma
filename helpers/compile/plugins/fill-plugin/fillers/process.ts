export const process: NodeJS.Process = {
  nextTick: (fn: Function, ...args: unknown[]) => {
    setTimeout(() => {
      fn(...args)
    }, 0)
  },
  env: {},
  version: '',
  cwd: () => '/',
  stderr: { fd: 2, isTTY: false } as any,
  stdin: { fd: 0, isTTY: false } as any,
  stdout: { fd: 1, isTTY: false } as any,
  argv: ['/bin/node'],
  // @ts-expect-error
  browser: true,
}
