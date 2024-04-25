import { detectRuntime, Runtime } from 'detect-runtime'

const runtimesPrettyNames = {
  node: 'Node.js',
  workerd: 'Cloudflare Workers',
  deno: 'Deno and Deno Deploy',
  netlify: 'Netlify Edge Functions',
  'edge-light': 'Vercel Edge Functions or Edge Middleware',
} as const

type GetRuntimeOutput = {
  id: Runtime
  prettyName: string
  isEdge: boolean
}

export function getRuntime(): GetRuntimeOutput {
  const runtimeId = detectRuntime()

  return {
    id: runtimeId,
    // Fallback to the runtimeId if the runtime is not in the list
    prettyName: runtimesPrettyNames[runtimeId] || runtimeId,
    isEdge: ['workerd', 'deno', 'netlify', 'edge-light'].includes(runtimeId),
  }
}
