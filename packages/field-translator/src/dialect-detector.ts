/**
 * Build-time database dialect detection system
 * 
 * Analyzes project configuration to determine database type and select
 * appropriate transformation code generators.
 */

import type { DatabaseDialect } from './types.js'
import { UnsupportedDialectError } from './types.js'

/**
 * Configuration source for dialect detection
 */
export interface RefractConfig {
  /** Database URL or connection configuration */
  database?: {
    url?: string
    provider?: string
    dialect?: DatabaseDialect
  }
  /** Legacy datasource configuration support */
  datasources?: {
    db?: {
      provider?: string
      url?: string
    }
  }[]
}

/**
 * Kysely dialect detection from runtime instances
 */
export interface KyselyDialectInfo {
  dialectName: string
  driverName?: string
}

/**
 * Build-time dialect detection utilities
 */
export class DialectDetector {
  /**
   * Detect database dialect from Refract configuration
   */
  static detectFromConfig(config: RefractConfig): DatabaseDialect {
    // Direct dialect specification
    if (config.database?.dialect) {
      return this.validateDialect(config.database.dialect)
    }

    // Provider-based detection
    if (config.database?.provider) {
      return this.dialectFromProvider(config.database.provider)
    }

    // URL-based detection
    if (config.database?.url) {
      return this.dialectFromUrl(config.database.url)
    }

    // Legacy datasources support
    if (config.datasources?.[0]?.db) {
      const datasource = config.datasources[0].db
      if (datasource.provider) {
        return this.dialectFromProvider(datasource.provider)
      }
      if (datasource.url) {
        return this.dialectFromUrl(datasource.url)
      }
    }

    // Default fallback
    throw new Error('Unable to detect database dialect from configuration')
  }

  /**
   * Detect dialect from database URL
   */
  static dialectFromUrl(url: string): DatabaseDialect {
    const urlLower = url.toLowerCase()
    
    if (urlLower.startsWith('postgres://') || urlLower.startsWith('postgresql://')) {
      return 'postgresql'
    }
    if (urlLower.startsWith('mysql://')) {
      return 'mysql'
    }
    if (urlLower.startsWith('sqlite:') || urlLower.includes('.db') || urlLower.includes('.sqlite')) {
      return 'sqlite'
    }
    if (urlLower.startsWith('sqlserver://') || urlLower.startsWith('mssql://')) {
      return 'sqlserver'
    }

    throw new Error(`Unable to detect dialect from URL: ${url}`)
  }

  /**
   * Detect dialect from provider name
   */
  static dialectFromProvider(provider: string): DatabaseDialect {
    const providerLower = provider.toLowerCase()
    
    switch (providerLower) {
      case 'postgresql':
      case 'postgres':
      case 'pg':
        return 'postgresql'
      
      case 'mysql':
      case 'mariadb':
        return 'mysql'
      
      case 'sqlite':
      case 'better-sqlite3':
      case 'sqlite3':
        return 'sqlite'
      
      case 'sqlserver':
      case 'mssql':
        return 'sqlserver'
      
      default:
        throw new Error(`Unsupported provider: ${provider}`)
    }
  }

  /**
   * Detect dialect from Kysely dialect instance info
   */
  static dialectFromKysely(dialectInfo: KyselyDialectInfo): DatabaseDialect {
    const dialectName = dialectInfo.dialectName.toLowerCase()
    
    if (dialectName.includes('postgres')) {
      return 'postgresql'
    }
    if (dialectName.includes('mysql') || dialectName.includes('mariadb')) {
      return 'mysql'
    }
    if (dialectName.includes('sqlite')) {
      return 'sqlite'
    }
    if (dialectName.includes('mssql') || dialectName.includes('sqlserver')) {
      return 'sqlserver'
    }

    throw new Error(`Unable to detect dialect from Kysely dialect: ${dialectName}`)
  }

  /**
   * Validate that a dialect string is supported
   */
  static validateDialect(dialect: string): DatabaseDialect {
    const supportedDialects: DatabaseDialect[] = ['postgresql', 'mysql', 'sqlite', 'sqlserver']
    
    if (supportedDialects.includes(dialect as DatabaseDialect)) {
      return dialect as DatabaseDialect
    }
    
    throw new UnsupportedDialectError(dialect)
  }

  /**
   * Get all supported dialects
   */
  static getSupportedDialects(): DatabaseDialect[] {
    return ['postgresql', 'mysql', 'sqlite', 'sqlserver']
  }

  /**
   * Check if a dialect is supported
   */
  static isDialectSupported(dialect: string): dialect is DatabaseDialect {
    return this.getSupportedDialects().includes(dialect as DatabaseDialect)
  }
}

/**
 * Convenience function for detecting dialect from various sources
 */
export function detectDialect(
  source: RefractConfig | string | KyselyDialectInfo
): DatabaseDialect {
  if (typeof source === 'string') {
    // Assume it's a URL or provider string
    if (source.includes('://') || source.includes('.db') || source.includes('.sqlite')) {
      return DialectDetector.dialectFromUrl(source)
    } else {
      return DialectDetector.dialectFromProvider(source)
    }
  }
  
  if ('dialectName' in source) {
    return DialectDetector.dialectFromKysely(source)
  }
  
  return DialectDetector.detectFromConfig(source)
}