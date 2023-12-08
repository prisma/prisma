import { detectRuntime } from 'detect-runtime'

export * from '@prisma/driver-adapter-utils'

export function initialize() {
  const sym = Symbol.for('prisma:client:engine:wasm:loaded')

  if (detectRuntime() === 'edge-light') {
    globalThis[sym] ??= async () => (await import(`../runtime/query-engine.wasm${'?module'}`)).default
  } else {
    globalThis[sym] ??= async () => (await import(`../runtime/query-engine.wasm`)).default
  }
}
