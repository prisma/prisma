import { runtime as runtimeId, type RuntimeName } from 'std-env'

// Note: 'fastly' - yet another Edge serverless platform - is currently not considered by Prisma.
const runtimesPrettyNames = {
  node: 'Node.js',
  workerd: 'Cloudflare Workers',
  deno: 'Deno and Deno Deploy',
  netlify: 'Netlify Edge Functions',
  'edge-light': 'Edge Runtime (Vercel Edge Functions, Vercel Edge Middleware, Next.js (Pages Router) Edge API Routes, Next.js (App Router) Edge Route Handlers or Next.js Middleware)',
} as const

type GetRuntimeOutput = {
  id: RuntimeName
  prettyName: string
  isEdge: boolean
}

export function getRuntime(): GetRuntimeOutput {
  return {
    id: runtimeId,
    // Fallback to the runtimeId if the runtime is not in the list
    prettyName: runtimesPrettyNames[runtimeId] || runtimeId,
    isEdge: ['workerd', 'deno', 'netlify', 'edge-light'].includes(runtimeId),
  }
}
