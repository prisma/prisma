import { detectRuntime } from 'detect-runtime'

export function getRuntimeName(): string {
  const runtime = detectRuntime()
  const runtimeName = {
    node: 'Node.js',
    workerd: 'Cloudflare Workers',
    deno: 'Deno and Deno Deploy',
    netlify: 'Netlify Edge Functions',
    'edge-light': 'Vercel Edge Functions or Edge Middleware',
  }[runtime]

  return runtimeName || runtime
}
