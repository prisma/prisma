export const supportedInternalRuntimes = ['nodejs', 'workerd', 'edge-light', 'react-native'] as const
const supportedPublicRuntimes = [
  'nodejs',
  'deno',
  'bun',
  'workerd',
  'cloudflare',
  'edge-light',
  'vercel',
  'react-native',
] as const

/**
 * The user-facing `runtime` attribute for the `prisma-client` generator.
 */
export type RuntimeTarget = (typeof supportedPublicRuntimes)[number]

/**
 * The internal representation of the `runtime` attribute for the `prisma-client` generator.
 */
export type RuntimeTargetInternal = (typeof supportedInternalRuntimes)[number]

function parseRuntimeTarget(target: RuntimeTarget | (string & {})): RuntimeTargetInternal {
  switch (target.toLowerCase()) {
    case 'workerd':
    case 'cloudflare':
      return 'workerd'

    case 'edge-light':
    case 'vercel':
      return 'edge-light'

    case 'nodejs':
    case 'deno':
    case 'bun':
      return 'nodejs'

    case 'react-native':
      return 'react-native'

    default:
      throw new Error(
        `Unknown target runtime: "${target}". The available options are: ${supportedPublicRuntimes
          .map((runtime) => `"${runtime}"`)
          .join(', ')}`,
      )
  }
}

export function parseRuntimeTargetFromUnknown(target: unknown) {
  if (typeof target !== 'string') {
    throw new Error(`Invalid target runtime: ${JSON.stringify(target)}. Expected a string.`)
  }
  return parseRuntimeTarget(target)
}
