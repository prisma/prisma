import path from 'path'

import { Fillers, load } from '../fillPlugin'

export const edgePreset: Fillers = {
  // enabled
  // assert: { path: load('assert-browserify') },
  buffer: { path: load('buffer') },
  // constants: { path: load('constants-browserify') },
  // crypto: { path: load('crypto-browserify') },
  // domain: { path: load('domain-browser') },
  events: { path: load('eventemitter3') },
  // http: { path: load('stream-http') },
  // https: { path: load('https-browserify') },
  // inherits: { path: load('inherits') },
  // os: { path: load('os-browserify') },
  path: { path: load('path-browserify') },
  // punycode: { path: load('punycode') },
  // querystring: { path: load('querystring-es3') },
  // stream: { path: load('readable-stream') },
  // string_decoder: { path: load('string_decoder') },
  // sys: { path: load('util') },
  // timers: { path: load('timers-browserify') },
  tty: { path: load('tty-browserify') },
  // url: { path: load('url') },
  util: { path: load('util') },
  // vm: { path: load('vm-browserify') },
  // zlib: { path: load('browserify-zlib') },

  // no shims
  fs: { path: path.join(__dirname, 'edge', 'fs.ts') },
  http2: { contents: '' },
  dns: { contents: '' },
  dgram: { contents: '' },
  cluster: { contents: '' },
  module: { contents: '' },
  net: { contents: '' },
  readline: { contents: '' },
  repl: { contents: '' },
  tls: { contents: '' },
  perf_hooks: { path: path.join(__dirname, 'edge', 'perf_hooks.ts') },
  async_hooks: { contents: '' },
  child_process: { contents: '' },

  // globals
  Buffer: {
    inject: path.join(__dirname, 'edge', 'buffer.ts'),
  },
  process: {
    inject: path.join(__dirname, 'edge', 'process.ts'),
    path: path.join(__dirname, 'edge', 'process.ts'),
  },

  // we remove eval and Function for vercel edge
  eval: { define: 'undefined' },
  Function: {
    define: 'fn',
    inject: path.join(__dirname, 'edge', 'function.ts'),
  },

  // not needed
  // global: {
  //   define: '{}',
  // },
  // globalThis: {
  //   define: '{}',
  // },
  // console: { },
  // __dirname: { },
  // __filename: { },
  // clearImmediate: { },
  // clearInterval: { },
}
