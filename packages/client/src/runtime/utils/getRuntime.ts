// https://runtime-keys.proposal.wintercg.org/
export type RuntimeName = 'workerd' | 'deno' | 'netlify' | 'node' | 'bun' | 'edge-light' | '' /* unknown */

/**
 * Indicates if running in Node.js or a Node.js compatible runtime.
 *
 * **Note:** When running code in Bun and Deno with Node.js compatibility mode, `isNode` flag will be also `true`, indicating running in a Node.js compatible runtime.
 */
const isNode = () => globalThis.process?.release?.name === 'node'

/**
 * Indicates if running in Bun runtime.
 */
const isBun = () => !!globalThis.Bun || !!globalThis.process?.versions?.bun

/**
 * Indicates if running in Deno runtime.
 */
const isDeno = () => !!globalThis.Deno

/**
 * Indicates if running in Netlify runtime.
 */
const isNetlify = () => typeof globalThis.Netlify === 'object'

/**
 * Indicates if running in EdgeLight (Vercel Edge) runtime.
 */
const isEdgeLight = () => typeof globalThis.EdgeRuntime === 'object'

/**
 * Indicates if running in Cloudflare Workers runtime.
 * See: https://developers.cloudflare.com/workers/runtime-apis/web-standards/#navigatoruseragent
 */
const isWorkerd = () => globalThis.navigator?.userAgent === 'Cloudflare-Workers'

function detectRuntime(): RuntimeName {
  // Note: we're currently not taking 'fastly' into account. Why?
  const runtimeChecks = [
    [isNetlify, 'netlify'],
    [isEdgeLight, 'edge-light'],
    [isWorkerd, 'workerd'],
    [isDeno, 'deno'],
    [isBun, 'bun'],
    [isNode, 'node'],
  ] as const

  const detectedRuntime =
    runtimeChecks
      // TODO: Transforming destructuring to the configured target environment ('chrome58', 'edge16', 'firefox57', 'safari11') is not supported yet,
      // so we can't write the following code yet:
      // ```
      // .flatMap(([isCurrentRuntime, runtime]) => isCurrentRuntime() ? [runtime] : [])
      // ```
      .flatMap((check) => (check[0]() ? [check[1]] : []))
      .at(0) ?? ''

  return detectedRuntime
}

const runtimesPrettyNames = {
  node: 'Node.js',
  workerd: 'Cloudflare Workers',
  deno: 'Deno and Deno Deploy',
  netlify: 'Netlify Edge Functions',
  'edge-light':
    'Edge Runtime (Vercel Edge Functions, Vercel Edge Middleware, Next.js (Pages Router) Edge API Routes, Next.js (App Router) Edge Route Handlers or Next.js Middleware)',
} as const

type GetRuntimeOutput = {
  id: RuntimeName
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
