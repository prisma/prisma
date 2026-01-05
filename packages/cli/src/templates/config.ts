/**
 * Configuration templates for different database providers
 */

export interface ConfigTemplate {
  provider: string
  defaultUrl: string
  envVarName: string
  description: string
  installInstructions?: string
  additionalConfig?: Record<string, any>
}

export const CONFIG_TEMPLATES: Record<string, ConfigTemplate> = {
  postgresql: {
    provider: 'postgresql',
    defaultUrl: 'postgresql://username:password@localhost:5432/database',
    envVarName: 'DATABASE_URL',
    description: 'PostgreSQL database',
  },
  mysql: {
    provider: 'mysql',
    defaultUrl: 'mysql://username:password@localhost:3306/database',
    envVarName: 'DATABASE_URL',
    description: 'MySQL database',
  },
  sqlite: {
    provider: 'sqlite',
    defaultUrl: 'file:./dev.db',
    envVarName: 'DATABASE_URL',
    description: 'SQLite database file',
  },
  neon: {
    provider: 'neon',
    defaultUrl: 'postgresql://username:password@ep-example.us-east-1.aws.neon.tech/database',
    envVarName: 'DATABASE_URL',
    description: 'Neon serverless PostgreSQL',
    installInstructions: 'npm install @neondatabase/serverless',
  },
  supabase: {
    provider: 'supabase',
    defaultUrl: 'postgresql://postgres:password@db.project.supabase.co:5432/postgres',
    envVarName: 'DATABASE_URL',
    description: 'Supabase PostgreSQL',
    installInstructions: 'npm install @supabase/supabase-js',
  },
  d1: {
    provider: 'd1',
    defaultUrl: 'file:./local.db',
    envVarName: 'DATABASE_URL',
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
      provider: '@refract/client',
      output: './.refract',
      ...additionalOptions.generator,
    },
    schema: './schema.prisma',
    ...additionalOptions,
  }

  // Remove nested objects from spread
  delete config.datasource
  delete config.generator

  const configLines = [
    "import type { RefractConfig } from '@refract/config'",
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
    "    provider: '@refract/client',",
    "    output: './.refract',",
    '  },',
    "  schema: './schema.prisma',",
    '} satisfies RefractConfig',
    '',
  )

  return configLines.join('\n')
}

/**
 * Generate environment file content
 */
export function generateEnvContent(provider: string, url: string): string {
  const template = CONFIG_TEMPLATES[provider]
  const envVarName = template?.envVarName || 'DATABASE_URL'

  const lines = ['# Database connection', `# ${template?.description || provider}`, `${envVarName}="${url}"`, '']

  if (template?.installInstructions) {
    lines.unshift(`# Install required packages: ${template.installInstructions}`, '')
  }

  return lines.join('\n')
}
