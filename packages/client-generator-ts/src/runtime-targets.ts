const supportedRuntimes = ['nodejs', 'deno', 'bun', 'workerd', 'edge-light', 'react-native'] as const

export type RuntimeTarget = (typeof supportedRuntimes)[number]

export function parseRuntimeTarget(target: string): RuntimeTarget {
  switch (target.toLowerCase()) {
    case 'node':
    case 'nodejs':
      return 'nodejs'
    case 'deno':
    case 'deno-deploy':
      return 'deno'
    case 'bun':
      return 'bun'
    case 'workerd':
    case 'cloudflare':
      return 'workerd'
    case 'edge-light':
    case 'vercel':
      return 'edge-light'
    case 'react-native':
      return 'react-native'
    default:
      throw new Error(
        `Unknown target runtime: "${target}". The available options are: ${supportedRuntimes
          .map((runtime) => `"${runtime}"`)
          .join(', ')}`,
      )
  }
}

export function parseRuntimeTargetFromUnknown(target: unknown): RuntimeTarget {
  if (typeof target !== 'string') {
    throw new Error(`Invalid target runtime: ${JSON.stringify(target)}. Expected a string.`)
  }
  return parseRuntimeTarget(target)
}
