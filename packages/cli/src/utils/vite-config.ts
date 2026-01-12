import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const VITE_CONFIG_FILES = [
  'vite.config.ts',
  'vite.config.js',
  'vite.config.mts',
  'vite.config.cts',
  'vite.config.mjs',
  'vite.config.cjs',
]

type PatchResult = {
  updated: boolean
  reason?: string
  filePath?: string
}

export const findViteConfigPath = (cwd: string): string | null => {
  for (const file of VITE_CONFIG_FILES) {
    const fullPath = join(cwd, file)
    if (existsSync(fullPath)) {
      return fullPath
    }
  }
  return null
}

const hasOrkPlugin = (content: string): boolean => content.includes('unplugin-ork') || /ork\s*\(/.test(content)

const insertImport = (content: string, importLine: string): string => {
  const importRegex = /^import[\s\S]*?from\s+['"][^'"]+['"];?$/gm
  let lastMatch: RegExpExecArray | null = null
  let match: RegExpExecArray | null

  while ((match = importRegex.exec(content)) !== null) {
    lastMatch = match
  }

  if (!lastMatch) {
    return `${importLine}\n\n${content}`
  }

  const insertPosition = lastMatch.index + lastMatch[0].length
  return `${content.slice(0, insertPosition)}\n${importLine}${content.slice(insertPosition)}`
}

const addPluginToDefineConfig = (content: string, pluginSnippet: string): string | null => {
  const pluginsRegex = /plugins\s*:\s*\[/m
  if (pluginsRegex.test(content)) {
    return content.replace(pluginsRegex, (match) => `${match}\n    ${pluginSnippet},`)
  }

  const defineConfigRegex = /defineConfig\s*\(\s*\{/m
  if (defineConfigRegex.test(content)) {
    return content.replace(defineConfigRegex, (match) => `${match}\n  plugins: [${pluginSnippet}],`)
  }

  const exportDefaultRegex = /export\s+default\s*\{/m
  if (exportDefaultRegex.test(content)) {
    return content.replace(exportDefaultRegex, (match) => `${match}\n  plugins: [${pluginSnippet}],`)
  }

  return null
}

export const patchViteConfig = (viteConfigPath: string): PatchResult => {
  if (!existsSync(viteConfigPath)) {
    return { updated: false, reason: 'Vite config not found' }
  }

  const content = readFileSync(viteConfigPath, 'utf8')

  if (hasOrkPlugin(content)) {
    return { updated: false, reason: 'Vite config already includes Ork plugin', filePath: viteConfigPath }
  }

  const withImport = insertImport(content, "import ork from 'unplugin-ork/vite'")
  const pluginSnippet = 'ork({ autoGenerateClient: true, autoMigrate: true })'
  const updated = addPluginToDefineConfig(withImport, pluginSnippet)

  if (!updated) {
    return {
      updated: false,
      reason: 'Unable to auto-patch Vite config (non-standard structure)',
      filePath: viteConfigPath,
    }
  }

  writeFileSync(viteConfigPath, updated, 'utf8')
  return { updated: true, filePath: viteConfigPath }
}
