import type { OrkConfig } from '@ork/config'
import { PROVIDER_URL_PATTERNS, SUPPORTED_PROVIDERS, type DatabaseProvider } from '@ork/config'

const SUPPORTED_FORMATS = ['postgresql://', 'mysql://', 'file:', 'd1://']

export function detectProviderFromUrl(url: string): DatabaseProvider {
  for (const [provider, pattern] of Object.entries(PROVIDER_URL_PATTERNS)) {
    if (pattern(url)) {
      return provider as DatabaseProvider
    }
  }

  throw new Error(`Unable to detect provider from URL: ${url}. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`)
}

export function createConfigWithAutoDetection(url: string, additionalOptions: Partial<OrkConfig> = {}): OrkConfig {
  const detectedProvider = detectProviderFromUrl(url)
  const provider = additionalOptions.datasource?.provider ?? detectedProvider
  const { datasource, generator, schema, ...rest } = additionalOptions

  return {
    datasource: {
      provider,
      url,
      ...datasource,
    },
    ...(generator ? { generator } : {}),
    schema: schema ?? './schema.prisma',
    ...rest,
  }
}

export function validateProviderUrlCompatibility(
  provider: DatabaseProvider,
  url: string,
): {
  isValid: boolean
  message?: string
} {
  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    return { isValid: false, message: `Unknown provider: ${provider}` }
  }

  const detectedProvider = detectProviderFromUrl(url)

  if (detectedProvider === provider) {
    return { isValid: true }
  }

  return {
    isValid: false,
    message: `URL is not compatible with provider ${provider}. Detected ${detectedProvider} instead.`,
  }
}
