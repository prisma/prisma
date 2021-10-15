function noop<T = undefined>(v: T) {
  return () => v as T
}

const tickPromise = Promise.resolve()

function getProcess() {
  return process
}

export const process: NodeJS.Process = {
  abort: noop(undefined as never),
  addListener: noop(getProcess()),
  allowedNodeEnvironmentFlags: new Set(),
  arch: 'x64',
  argv: ['/bin/node'],
  argv0: 'node',
  chdir: noop(undefined),
  config: {
    target_defaults: {
      cflags: [],
      default_configuration: '',
      defines: [],
      include_dirs: [],
      libraries: [],
    },
    variables: {
      clang: 0,
      host_arch: 'x64',
      node_install_npm: false,
      node_install_waf: false,
      node_prefix: '',
      node_shared_openssl: false,
      node_shared_v8: false,
      node_shared_zlib: false,
      node_use_dtrace: false,
      node_use_etw: false,
      node_use_openssl: false,
      target_arch: 'x64',
      v8_no_strict_aliasing: 0,
      v8_use_snapshot: false,
      visibility: '',
    },
  },
  connected: false,
  cpuUsage: () => ({ user: 0, system: 0 }),
  cwd: () => '/',
  debugPort: 0,
  disconnect: noop(undefined),
  domain: {
    ...{
      run: noop(undefined),
      add: noop(undefined),
      remove: noop(undefined),
      bind: noop(undefined),
      intercept: noop(undefined),
    },
    ...getProcess(),
  } as any,
  emit: noop(getProcess() as any),
  emitWarning: noop(undefined),
  env: {},
  eventNames: () => [],
  execArgv: [],
  execPath: '/',
  exit: noop(undefined as never),
  features: {
    inspector: false,
    debug: false,
    uv: false,
    ipv6: false,
    tls_alpn: false,
    tls_sni: false,
    tls_ocsp: false,
    tls: false,
  },
  getMaxListeners: noop(0),
  getegid: noop(0),
  geteuid: noop(0),
  getgid: noop(0),
  getgroups: noop([]),
  getuid: noop(0),
  hasUncaughtExceptionCaptureCallback: noop(false),
  hrtime: noop([0, 0]) as NodeJS.HRTime,
  platform: 'linux',
  kill: noop(true),
  listenerCount: noop(0),
  listeners: noop([]),
  memoryUsage: noop({
    arrayBuffers: 0,
    external: 0,
    heapTotal: 0,
    heapUsed: 0,
    rss: 0,
  }),
  nextTick: (fn: Function, ...args: unknown[]) => {
    tickPromise
      .then(() => fn(...args))
      .catch((e) => {
        setTimeout(() => {
          throw e
        }, 0)
      })
  },
  off: noop(getProcess()),
  on: noop(getProcess()),
  once: noop(getProcess()),
  openStdin: noop({} as NodeJS.Socket),
  pid: 0,
  ppid: 0,
  prependListener: noop(getProcess()),
  prependOnceListener: noop(getProcess()),
  rawListeners: noop([]),
  release: {
    name: 'node',
  },
  removeAllListeners: noop(getProcess()),
  removeListener: noop(getProcess()),
  resourceUsage: noop({
    fsRead: 0,
    fsWrite: 0,
    involuntaryContextSwitches: 0,
    ipcReceived: 0,
    ipcSent: 0,
    majorPageFault: 0,
    maxRSS: 0,
    minorPageFault: 0,
    sharedMemorySize: 0,
    signalsCount: 0,
    swappedOut: 0,
    systemCPUTime: 0,
    unsharedDataSize: 0,
    unsharedStackSize: 0,
    userCPUTime: 0,
    voluntaryContextSwitches: 0,
  }),
  setMaxListeners: noop(getProcess()),
  setUncaughtExceptionCaptureCallback: noop(undefined),
  setegid: noop(undefined),
  seteuid: noop(undefined),
  setgid: noop(undefined),
  setgroups: noop(undefined),
  setuid: noop(undefined),
  stderr: {
    fd: 2,
  } as any,
  stdin: {
    fd: 0,
  } as any,
  stdout: {
    fd: 1,
  } as any,
  title: 'node',
  traceDeprecation: false,
  umask: noop(0),
  uptime: noop(0),
  version: '',
  versions: {
    http_parser: '',
    node: '',
    v8: '',
    ares: '',
    uv: '',
    zlib: '',
    modules: '',
    openssl: '',
  },
}
