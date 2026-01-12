/**
 * Core unplugin-ork functionality
 * Provides virtual modules for clean .ork/types imports
 */

import { existsSync, readFileSync } from 'node:fs'
import fs from 'node:fs/promises'
import path, { resolve } from 'node:path'

import { ClientGenerator } from '@ork/client'
import { type ConfigLoadResult, getDefaultOutputDir, loadOrkConfig, type OrkConfig } from '@ork/config'
import { type DatabaseDialect, detectDialect } from '@ork/field-translator'
import { OrkMigrate } from '@ork/migrate'
import { parseSchema } from '@ork/schema-parser'
import { watch } from 'chokidar'
import { createUnplugin } from 'unplugin'

import { DevOutput } from './dev-output.js'
import { ProductionBuildManager } from './production-build.js'
import type { BuildContext, GeneratedClientCode, GeneratedTypes, OrkPluginOptions, SchemaChangeInfo } from './types.js'
import { VirtualModuleManager, VirtualModuleResolver, VirtualTypeGenerator } from './virtual-modules.js'

export const unpluginOrk = createUnplugin<OrkPluginOptions>((options = {}) => {
  const {
    schema = './schema.prisma',
    watch: enableWatch = true,
    debug = false,
    silent = false,
    preserveLogs = false,
    autoGenerateClient = true,
    autoMigrate = false,
    autoMigrateMode = 'safe',
    onSchemaChange,
    root = process.cwd(),
    production = {},
  } = options

  // Detect build context
  const buildContext: BuildContext = {
    isProduction: process.env.NODE_ENV === 'production',
    isDevelopment: process.env.NODE_ENV !== 'production',
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    bundler: detectBundler(),
  }

  // Initialize enhanced development experience
  const devOutput = new DevOutput({
    debug,
    silent: silent || (buildContext.isProduction && !debug),
    preserveLogs,
  })

  // Initialize virtual module system
  const moduleManager = new VirtualModuleManager(debug)
  const moduleResolver = new VirtualModuleResolver()
  const typeGenerator = new VirtualTypeGenerator(debug)

  // Initialize production build manager
  const productionManager = new ProductionBuildManager(production, devOutput, buildContext)

  let schemaWatcher: any = null
  let lastSchemaContent = ''
  let regenerationTimer: NodeJS.Timeout | null = null
  const DEBOUNCE_DELAY = buildContext.isProduction ? 50 : 100 // Faster in production

  // Generated client state
  let detectedDialect: DatabaseDialect | null = null
  let orkConfig: ConfigLoadResult | null = null
  let generatedClientCode: GeneratedClientCode | null = null

  // Legacy debug logging for backward compatibility
  const log = (message: string) => {
    devOutput.debug(message)
  }

  // Detect which bundler is being used
  function detectBundler(): BuildContext['bundler'] {
    // Check for Vite
    if (process.env.VITE_ROOT || typeof globalThis.viteDevServer !== 'undefined') {
      return 'vite'
    }
    // Check for Webpack
    if (process.env.WEBPACK_DEV_SERVER || typeof globalThis.webpack !== 'undefined') {
      return 'webpack'
    }
    // Check for Rollup
    if (process.env.ROLLUP_WATCH) {
      return 'rollup'
    }
    // Check for ESBuild
    if (process.env.ESBUILD) {
      return 'esbuild'
    }
    // Default fallback
    return undefined
  }

  const resolveSchemaPath = () => {
    return resolve(root, schema)
  }

  const detectDatabaseDialect = async (): Promise<DatabaseDialect> => {
    if (detectedDialect) {
      return detectedDialect
    }

    try {
      // Load ork config to detect database type
      orkConfig = await loadOrkConfig({ cwd: root })
      detectedDialect = detectDialect(orkConfig.config.datasource.provider)

      log(`Detected database dialect: ${detectedDialect}`)
      return detectedDialect
    } catch (error) {
      devOutput.debug(`Failed to detect database dialect: ${error}`)
      // Fallback to SQLite for compatibility
      detectedDialect = 'sqlite'
      return detectedDialect
    }
  }

  const formatList = (label: string, values: string[]): string | null => {
    if (!values.length) return null
    const shown = values.slice(0, 3).join(', ')
    const suffix = values.length > 3 ? `, +${values.length - 3} more` : ''
    return `${label}: ${shown}${suffix}`
  }

  const ensureOrkConfig = async (): Promise<ConfigLoadResult> => {
    if (!orkConfig) {
      orkConfig = await loadOrkConfig({ cwd: root })
    }
    return orkConfig
  }

  const writeGeneratedClient = async (
    schemaPath: string,
    schemaContent: string,
    config: OrkConfig,
    configDir: string,
    configPath: string | null,
  ): Promise<string> => {
    const parseResult = parseSchema(schemaContent)

    if (parseResult.errors.length > 0) {
      throw new Error(`Schema parsing failed: ${parseResult.errors.map((e) => e.message).join(', ')}`)
    }

    const datasource = parseResult.ast.datasources?.[0]
    const generatorConfig = datasource
      ? {
          database: {
            provider: datasource.provider?.toLowerCase(),
            url: datasource.url,
          },
        }
      : undefined

    const outputDir = config.generator?.output || getDefaultOutputDir(configPath)
    const resolvedOutputDir = path.resolve(configDir, outputDir)

    await fs.mkdir(resolvedOutputDir, { recursive: true })

    const generator = new ClientGenerator(parseResult.ast, {
      includeTypes: true,
      includeJSDoc: true,
      esModules: true,
      config: generatorConfig,
    })

    const clientContent = generator.generateClientModule()
    const clientPath = path.join(resolvedOutputDir, 'index.ts')
    await fs.writeFile(clientPath, clientContent, 'utf-8')

    return clientPath
  }

  const runMigrations = async (
    schemaPath: string,
  ): Promise<{ migrated: boolean; skippedReason?: string; error?: string }> => {
    const { createKyselyFromConfig } = await import('@ork/config')

    let kysely: Awaited<ReturnType<typeof createKyselyFromConfig>>['kysely'] | null = null
    try {
      const result = await createKyselyFromConfig({ cwd: root })
      kysely = result.kysely
      const migrate = new OrkMigrate({ useTransaction: true, validateSchema: true })

      const diff = await migrate.diff(kysely, schemaPath)

      if (diff.statements.length === 0) {
        devOutput.info('No migration changes detected')
        return { migrated: true }
      }

      if (autoMigrateMode === 'safe' && diff.hasDestructiveChanges) {
        const destructiveSummary = [
          formatList('tablesDropped', diff.summary.tablesDropped),
          formatList(
            'columnsDropped',
            diff.summary.columnsDropped.map((col) => `${col.table}.${col.column}`),
          ),
          formatList('foreignKeysDropped', diff.summary.foreignKeysDropped),
          formatList('enumsDropped', diff.summary.enumsDropped),
        ]
          .filter(Boolean)
          .join(', ')

        const warningSummary =
          destructiveSummary.length === 0 && diff.impact.warnings.length > 0
            ? `warnings: ${diff.impact.warnings.slice(0, 2).join('; ')}${diff.impact.warnings.length > 2 ? '…' : ''}`
            : ''
        const details = destructiveSummary || warningSummary
        const reason = details ? `Destructive changes detected (${details})` : 'Destructive changes detected'
        devOutput.warn(`${reason}. Set autoMigrateMode: 'force' to apply, or run \`ork migrate\` manually.`)
        return { migrated: false, skippedReason: reason }
      }

      devOutput.info(`Applying ${diff.statements.length} migration statement(s)`)
      const applyResult = await migrate.apply(kysely, schemaPath)

      if (!applyResult.success) {
        return { migrated: false, error: applyResult.errors.map((err) => err.message).join(', ') }
      }

      devOutput.info('Migrations applied')
      return { migrated: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('better-sqlite3') || message.includes('Missing database driver')) {
        return { migrated: false, skippedReason: message }
      }
      return { migrated: false, error: message }
    } finally {
      if (kysely) {
        await kysely.destroy()
      }
    }
  }

  const generateTypesFromSchema = (schemaContent: string): GeneratedTypes => {
    try {
      const parseResult = parseSchema(schemaContent)

      if (parseResult.errors.length > 0) {
        // Show enhanced error output
        devOutput.showSchemaError(
          parseResult.errors.map((e) => ({
            message: e.message,
            line: e.span.start.line,
            column: e.span.start.column,
          })),
        )

        // Return partial types with error information
        return {
          interfaces: `// Schema parsing errors: ${parseResult.errors.map((e) => e.message).join(', ')}`,
          schema: 'export interface DatabaseSchema { [key: string]: any }',
          augmentation: `declare module '@ork/client' { interface OrkGeneratedSchema extends DatabaseSchema {} }`,
        }
      }

      if (parseResult.ast.models.length === 0) {
        devOutput.warn('No models found in schema - will generate empty types')
        return {
          interfaces: '// No models found in schema',
          schema: 'export interface DatabaseSchema { [key: string]: any }',
          augmentation: `declare module '@ork/client' { interface OrkGeneratedSchema extends DatabaseSchema {} }`,
        }
      }

      // Generate enhanced TypeScript interfaces with better types
      const interfaces = parseResult.ast.models
        .map((model) => {
          const fields = model.fields
            .map((field) => {
              const optional = field.isOptional ? '?' : ''
              const fieldType = mapFieldType(field.fieldType)
              const listSuffix = field.isList ? '[]' : ''

              return `  ${field.name}${optional}: ${fieldType}${listSuffix}`
            })
            .join('\n')

          const comment = `/**\n * ${model.name} model\n * Generated from schema.prisma\n */`
          return `${comment}\nexport interface ${model.name} {\n${fields}\n}`
        })
        .join('\n\n')

      // Generate database schema type with proper table names
      const schemaType = `/**\n * Database schema mapping\n * Maps table names to their TypeScript interfaces\n */\nexport interface DatabaseSchema {\n${parseResult.ast.models
        .map((model) => `  ${model.name.toLowerCase()}: ${model.name}`)
        .join('\n')}\n}`

      // Generate module augmentation for OrkClient
      const augmentation = `/**\n * Module augmentation for @ork/client\n * Provides automatic type inference for generated schema\n */\ndeclare module '@ork/client' {\n  interface OrkGeneratedSchema extends DatabaseSchema {}\n}`

      // Success - generated types for models
      log(`Generated types for ${parseResult.ast.models.length} models`)

      return {
        interfaces,
        schema: schemaType,
        augmentation,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Show enhanced error output for unexpected errors
      devOutput.showSchemaError([
        {
          message: `Unexpected error during type generation: ${errorMessage}`,
        },
      ])

      return {
        interfaces: `// Type generation error: ${errorMessage}`,
        schema: 'export interface DatabaseSchema { [key: string]: any }',
        augmentation: `declare module '@ork/client' { interface OrkGeneratedSchema extends DatabaseSchema {} }`,
      }
    }
  }

  const mapFieldType = (fieldType: string): string => {
    switch (fieldType) {
      case 'String':
        return 'string'
      case 'Int':
      case 'BigInt':
      case 'Float':
      case 'Decimal':
        return 'number'
      case 'Boolean':
        return 'boolean'
      case 'DateTime':
        return 'Date'
      case 'Json':
        return 'any'
      default:
        return 'any'
    }
  }

  const generateClientModuleFromSchema = async (schemaContent: string): Promise<GeneratedClientCode | null> => {
    try {
      const parseResult = parseSchema(schemaContent)

      if (parseResult.errors.length > 0) {
        devOutput.debug('Cannot generate client module due to schema errors')
        return null
      }

      if (parseResult.ast.models.length === 0) {
        devOutput.debug('Cannot generate client module - no models found')
        return null
      }

      // Detect database dialect
      const dialect = await detectDatabaseDialect()

      // Create client generator
      const generator = new ClientGenerator(parseResult.ast, {
        dialect,
        config: orkConfig?.config,
        includeTypes: true,
        includeJSDoc: true,
        esModules: true,
      })

      // Generate the client code
      const clientCode = generator.generateClientModule()

      // Extract TypeScript declarations (types only)
      const declarationLines = clientCode.split('\n').filter((line) => {
        return (
          line.startsWith('export interface') ||
          line.startsWith('export type') ||
          line.includes('interface ') ||
          line.includes('type ')
        )
      })
      const declarations = declarationLines.join('\n')

      log(`Generated client module for ${parseResult.ast.models.length} models with ${dialect} dialect`)

      return {
        clientCode,
        declarations,
        dialect,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      devOutput.debug(`Client generation error: ${errorMessage}`)
      return null
    }
  }

  const regenerateTypes = async (reason: string = 'Schema changed') => {
    const schemaPath = resolveSchemaPath()
    const changeInfo: SchemaChangeInfo = {
      reason,
      schemaPath,
      generatedClient: false,
      migrated: false,
    }

    // Start progress indication
    devOutput.startRegeneration(reason)

    if (!existsSync(schemaPath)) {
      devOutput.showFileError(schemaPath, 'File not found')

      // Generate fallback module
      moduleManager.setModule('types', typeGenerator.generateFallbackModule())
      moduleManager.setModule(
        'index',
        typeGenerator.generateIndexModule({
          interfaces: '',
          schema: 'export interface DatabaseSchema { [key: string]: any }',
          augmentation: '',
        }),
      )
      return
    }

    const schemaContent = readFileSync(schemaPath, 'utf-8')

    if (schemaContent === lastSchemaContent) {
      devOutput.debug('No changes detected, skipping regeneration')
      return // No changes
    }

    lastSchemaContent = schemaContent
    log(`Regenerating types from schema: ${schemaPath}`)

    // Generate both traditional types and the client module
    const generatedTypes = generateTypesFromSchema(schemaContent)
    generatedClientCode = await generateClientModuleFromSchema(schemaContent)

    // Check if parsing was successful (errors are already shown by generateTypesFromSchema)
    const hasErrors =
      generatedTypes.interfaces.includes('// Schema parsing errors:') ||
      generatedTypes.interfaces.includes('// Type generation error:')

    if (hasErrors) {
      // Handle build-time errors appropriately
      productionManager.handleBuildError(new Error('Schema parsing failed'), schemaPath)

      // Generate error modules for development
      moduleManager.setModule('types', typeGenerator.generateErrorModule('Failed to parse schema'))
      moduleManager.setModule(
        'client',
        typeGenerator.generateErrorModule('Generated client unavailable due to schema errors'),
      )
      moduleManager.setModule(
        'client-types',
        typeGenerator.generateErrorModule('Client types unavailable due to schema errors'),
      )
      changeInfo.errors = ['Schema parsing failed']
      onSchemaChange?.(changeInfo)
      return
    }

    // Use production build manager for optimized builds
    if (buildContext.isProduction) {
      try {
        const { modules, cached } = await productionManager.generateProductionModules(
          schemaPath,
          schemaContent,
          generatedTypes,
          generatedClientCode,
        )

        moduleManager.updateModules(modules)

        // Extract model count for success message
        const modelCount = (generatedTypes.interfaces.match(/export interface \w+ \{/g) || []).length
        devOutput.completeRegeneration(modelCount, Object.keys(modules).length)

        if (cached) {
          devOutput.debug('Used cached production modules for faster build')
        }
      } catch (error) {
        productionManager.handleBuildError(error as Error, schemaPath)
      }
    } else {
      // Development build - generate client modules
      const updates: Record<string, string> = {
        types: typeGenerator.generateTypesModule(generatedTypes),
        index: typeGenerator.generateIndexModule(generatedTypes, !!generatedClientCode),
        generated: typeGenerator.generateGeneratedTypesModule(generatedTypes),
      }

      // Add generated client modules if generation was successful
      if (generatedClientCode) {
        updates.client = typeGenerator.generateClientModule(generatedClientCode)
        updates['client-types'] = typeGenerator.generateClientTypesModule(generatedClientCode)
      } else {
        // Fallback: generate basic client pointing to manual client setup
        updates.client = typeGenerator.generateFallbackClientModule()
        updates['client-types'] = typeGenerator.generateFallbackClientTypesModule()
      }

      moduleManager.updateModules(updates)

      // Extract model count for success message
      const modelCount = (generatedTypes.interfaces.match(/export interface \w+ \{/g) || []).length
      const clientStatus = generatedClientCode
        ? ` (with generated client for ${generatedClientCode.dialect})`
        : ' (types only)'
      devOutput.completeRegeneration(modelCount, Object.keys(updates).length)
      devOutput.debug(`Generated modules: ${Object.keys(updates).join(', ')}${clientStatus}`)
    }

    if (autoGenerateClient) {
      try {
        const configResult = await ensureOrkConfig()
        const configDir = configResult?.configDir || root
        const configPath = configResult?.configPath || null
        const clientPath = await writeGeneratedClient(
          schemaPath,
          schemaContent,
          configResult.config,
          configDir,
          configPath,
        )
        changeInfo.generatedClient = true
        devOutput.info(`Client written to ${path.relative(root, clientPath)}`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        changeInfo.errors = [...(changeInfo.errors || []), message]
        devOutput.warn(`Client generation failed: ${message}`)
      }
    }

    if (autoMigrate) {
      try {
        await ensureOrkConfig()
        const migrationResult = await runMigrations(schemaPath)
        changeInfo.migrated = migrationResult.migrated
        if (migrationResult.skippedReason) {
          changeInfo.migrationSkippedReason = migrationResult.skippedReason
        }
        if (migrationResult.error) {
          changeInfo.errors = [...(changeInfo.errors || []), migrationResult.error]
          devOutput.warn(`Migration failed: ${migrationResult.error}`)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        changeInfo.errors = [...(changeInfo.errors || []), message]
        devOutput.warn(`Migration failed: ${message}`)
      }
    }

    onSchemaChange?.(changeInfo)
  }

  const debouncedRegenerateTypes = (reason: string = 'Schema changed') => {
    if (regenerationTimer) {
      clearTimeout(regenerationTimer)
    }

    regenerationTimer = setTimeout(async () => {
      try {
        await regenerateTypes(reason)
      } catch (error) {
        devOutput.debug(`Regeneration error: ${error}`)
      }
      regenerationTimer = null
    }, DEBOUNCE_DELAY)

    log(`Debounced regeneration scheduled (${DEBOUNCE_DELAY}ms)`)
  }

  const startWatching = () => {
    if (!enableWatch || schemaWatcher) return

    const schemaPath = resolveSchemaPath()

    schemaWatcher = watch(schemaPath, {
      ignoreInitial: false,
      persistent: true,
    })

    schemaWatcher.on('change', () => {
      devOutput.debug(`Schema file changed: ${schemaPath}`)
      debouncedRegenerateTypes('Schema file changed')
    })

    schemaWatcher.on('add', () => {
      devOutput.debug(`Schema file added: ${schemaPath}`)
      debouncedRegenerateTypes('Schema file created')
    })

    devOutput.showWatching(schemaPath)
  }

  const stopWatching = () => {
    if (schemaWatcher) {
      schemaWatcher.close()
      schemaWatcher = null
      log('Stopped watching schema file')
    }

    // Clean up any pending timers
    if (regenerationTimer) {
      clearTimeout(regenerationTimer)
      regenerationTimer = null
      log('Cleared pending regeneration timer')
    }
  }

  return {
    name: 'unplugin-ork',

    resolveId(id: string) {
      // Check if this is a virtual module import
      if (moduleResolver.isVirtualModule(id)) {
        const virtualId = moduleResolver.resolveVirtualId(id)
        if (virtualId) {
          log(`Resolving virtual module: ${id} -> ${virtualId}`)
          return virtualId
        }
      }
      return null
    },

    load(id: string) {
      // Load virtual modules
      const virtualId = moduleResolver.resolveVirtualId(id)
      if (virtualId) {
        const moduleKey = moduleResolver.getModuleKey(virtualId)
        const virtualModule = moduleManager.getModule(moduleKey)

        if (virtualModule) {
          log(`Loading virtual module: ${id} (${virtualModule.content.length} chars)`)
          return virtualModule.content
        } else {
          log(`Virtual module not found: ${id}`)
          // Return empty module to prevent build errors
          return 'export {}'
        }
      }
      return null
    },

    // Enhanced error handling with debouncing
    handleHotUpdate({ file, server }) {
      const schemaPath = resolveSchemaPath()
      if (file === schemaPath) {
        log(`Schema file changed via HMR: ${file}`)
        debouncedRegenerateTypes()

        // Invalidate virtual modules after a brief delay to allow regeneration
        setTimeout(() => {
          const moduleIds = moduleManager.getModuleIds()
          const virtualIds = moduleIds.map((key) => moduleResolver.resolveVirtualId(`.ork/${key}`)).filter(Boolean)

          virtualIds.forEach((id) => {
            const mod = server.moduleGraph.getModuleById(id)
            if (mod) {
              server.moduleGraph.invalidateModule(mod)
            }
          })

          server.ws.send({
            type: 'full-reload',
            path: '*',
          })
        }, DEBOUNCE_DELAY + 50) // Wait for debounced generation to complete

        return []
      }
      return []
    },

    // Vite-specific hooks
    vite: {
      configureServer(server) {
        // Enhanced HMR support
        const originalInvalidate = server.moduleGraph.invalidateModule.bind(server.moduleGraph)
        server.moduleGraph.invalidateModule = function (mod, ...args) {
          // Check if this is a virtual module invalidation
          if (mod?.id && moduleResolver.isVirtualModule(mod.id)) {
            log(`Invalidating virtual module: ${mod.id}`)
          }
          return originalInvalidate(mod, ...args)
        }

        // Custom HMR events with debouncing
        server.ws.on('ork:regenerate', () => {
          log('Manual regeneration requested')
          debouncedRegenerateTypes()
          setTimeout(() => {
            server.ws.send({
              type: 'full-reload',
              path: '*',
            })
          }, DEBOUNCE_DELAY + 50)
        })
      },

      // Apply Vite-specific optimizations
      config(config) {
        if (buildContext.isProduction) {
          const optimizations = productionManager.getBundlerOptimizations()
          if (optimizations.vite) {
            // Merge Vite optimizations
            config.build = {
              ...config.build,
              ...optimizations.vite.build,
            }
          }
        }

        // Ensure virtual modules are handled correctly
        config.optimizeDeps = config.optimizeDeps || {}
        config.optimizeDeps.exclude = config.optimizeDeps.exclude || []

        // Exclude ork virtual modules from optimization
        config.optimizeDeps.exclude.push('@ork/client', '@ork/field-translator', 'virtual:ork/*')

        // Add .ork modules to external list for proper resolution
        if (!config.build) config.build = {}
        if (!config.build.rollupOptions) config.build.rollupOptions = {}
        if (!config.build.rollupOptions.external) config.build.rollupOptions.external = []

        const external = config.build.rollupOptions.external as string[]
        external.push('.ork/client', '.ork/client-types', '.ork/types')
      },
    },

    // Build optimization
    async buildStart() {
      const schemaPath = resolveSchemaPath()
      devOutput.showStartup(schemaPath)

      try {
        await regenerateTypes('Initial build')
        startWatching()

        // Clean old cache files in production builds
        if (buildContext.isProduction) {
          await productionManager.cleanCache()
        }
      } catch (error) {
        devOutput.showSchemaError([
          {
            message: `Build start error: ${String(error)}`,
          },
        ])
        // Generate error module but don't fail the build unless in production
        moduleManager.setModule('types', typeGenerator.generateErrorModule(String(error)))

        if (buildContext.isProduction && production.failOnError !== false) {
          throw error
        }
      }
    },

    buildEnd() {
      try {
        stopWatching()
        devOutput.debug('Stopped watching schema file')
      } catch (error) {
        devOutput.debug(`Build end error: ${error}`)
      }
    },
  }
})
