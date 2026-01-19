/**
 * Configuration templates for different database providers
 */

export interface ConfigTemplate {
  provider: string
  description: string
  installInstructions?: string
  additionalConfig?: Record<string, any>
}

export const CONFIG_TEMPLATES: Record<string, ConfigTemplate> = {
  postgresql: {
    provider: 'postgresql',
    description: 'PostgreSQL database',
  },
  mysql: {
    provider: 'mysql',
    description: 'MySQL database',
  },
  sqlite: {
    provider: 'sqlite',
    description: 'SQLite database file',
  },
  d1: {
    provider: 'd1',
    description: 'Cloudflare D1 SQLite',
    installInstructions: 'npm install @cloudflare/workers-types',
    additionalConfig: {
      d1DatabaseId: 'your-d1-database-id',
    },
  },
}

/**
 * Generate configuration file content
 */
export function generateConfigContent(
  provider: string,
  url: string,
  additionalOptions: Record<string, any> = {},
): string {
  const template = CONFIG_TEMPLATES[provider]
  if (!template) {
    throw new Error(`Unknown provider: ${provider}`)
  }

  const config = {
    datasource: {
      provider,
      url,
      ...template.additionalConfig,
      ...additionalOptions.datasource,
    },
    generator: {
      provider: 'ork',
      output: './.ork',
      ...additionalOptions.generator,
    },
    schema: './schema.prisma',
    ...additionalOptions,
  }

  // Remove nested objects from spread
  delete config.datasource
  delete config.generator

  const configLines = [
    "import type { OrkConfig } from '@ork-orm/config'",
    '',
    'export default {',
    '  datasource: {',
    `    provider: '${provider}',`,
    `    url: '${url}',`,
  ]

  // Add additional datasource config
  if (template.additionalConfig) {
    Object.entries(template.additionalConfig).forEach(([key, value]) => {
      if (typeof value === 'string') {
        configLines.push(`    ${key}: '${value}',`)
      } else {
        configLines.push(`    ${key}: ${JSON.stringify(value)},`)
      }
    })
  }

  configLines.push(
    '  },',
    '  generator: {',
    "    provider: 'ork',",
    "    output: './.ork',",
    '  },',
    "  schema: './schema.prisma',",
    '} satisfies OrkConfig',
    '',
  )

  return configLines.join('\n')
}
