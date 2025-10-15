import { promises as fs } from 'fs'
import * as path from 'path'
import * as ts from 'typescript'

type PrismaValue =
  | { kind: 'env'; varName: string; raw: string }
  | { kind: 'literal'; value: string; quote: "'" | '"'; raw: string }

type SchemaTransformation = {
  updatedSchema: string
  urlValue: PrismaValue
  shadowValue: PrismaValue | null
}

const IGNORED_DIRECTORIES = new Set(['.git', 'node_modules', 'dist', 'build', '.turbo'])

async function main() {
  const root = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : process.cwd()

  const schemaFiles = await collectSchemaFiles(root)
  const results: string[] = []
  const skipped: string[] = []

  for (const schemaPath of schemaFiles) {
    try {
      const changed = await processSchemaFile(schemaPath)
      if (changed) {
        results.push(schemaPath)
      }
    } catch (error) {
      skipped.push(`${schemaPath}: ${(error as Error).message}`)
    }
  }

  if (results.length === 0 && skipped.length === 0) {
    console.log('No schema files required changes.')
  } else {
    if (results.length > 0) {
      console.log('Updated files:')
      for (const file of results) {
        console.log(`  - ${path.relative(root, file)}`)
      }
    }
    if (skipped.length > 0) {
      console.warn('Skipped files due to errors:')
      for (const message of skipped) {
        console.warn(`  - ${message}`)
      }
    }
  }
}

async function collectSchemaFiles(root: string): Promise<string[]> {
  const schemaFiles: string[] = []
  for await (const entry of walk(root)) {
    if (entry.isFile && entry.name === 'schema.prisma') {
      schemaFiles.push(entry.path)
    }
  }
  return schemaFiles.sort()
}

async function* walk(dir: string): AsyncGenerator<{
  path: string
  name: string
  isFile: boolean
  isDirectory: boolean
}> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) {
        yield* walk(entryPath)
      }
    } else if (entry.isFile()) {
      yield { path: entryPath, name: entry.name, isFile: true, isDirectory: false }
    }
  }
}

async function processSchemaFile(schemaPath: string): Promise<boolean> {
  const schemaDir = path.dirname(schemaPath)
  const configDir = path.basename(schemaDir) === 'prisma' ? path.dirname(schemaDir) : schemaDir
  const configPath = path.join(configDir, 'prisma.config.ts')

  if (await configHasJsEngine(configPath)) {
    return false
  }

  const schemaContent = await fs.readFile(schemaPath, 'utf8')
  const transformation = transformSchema(schemaContent)
  if (!transformation) {
    return false
  }

  await fs.mkdir(configDir, { recursive: true })

  let schemaChanged = false
  if (schemaContent !== transformation.updatedSchema) {
    await fs.writeFile(schemaPath, transformation.updatedSchema)
    schemaChanged = true
  }

  const configResult = await updateConfigFile(configPath, transformation.urlValue, transformation.shadowValue)

  return schemaChanged || configResult
}

function transformSchema(schemaContent: string): SchemaTransformation | null {
  const datasourceRegex = /datasource\s+\w+\s*{([\s\S]*?)}/m
  const match = datasourceRegex.exec(schemaContent)
  if (!match) {
    return null
  }

  const body = match[1]
  const blockStart = match.index
  const openingBraceIndex = schemaContent.indexOf('{', blockStart)
  if (openingBraceIndex === -1) {
    return null
  }

  const bodyStart = openingBraceIndex + 1
  const propertyDirect = findProperty(body, bodyStart, 'directUrl')
  const propertyUrl = findProperty(body, bodyStart, 'url')
  const propertyShadow = findProperty(body, bodyStart, 'shadowDatabaseUrl')

  const urlSource = propertyDirect ?? propertyUrl
  if (!urlSource) {
    return null
  }

  const urlValue = parsePrismaValue(urlSource.value)
  if (!urlValue) {
    throw new Error('Unsupported url value format')
  }

  const shadowValue = propertyShadow ? parsePrismaValue(propertyShadow.value) : null
  if (propertyShadow && !shadowValue) {
    throw new Error('Unsupported shadowDatabaseUrl value format')
  }

  const removals: Array<{ start: number; end: number }> = []
  if (propertyDirect && urlSource === propertyDirect) {
    removals.push({ start: propertyDirect.start, end: propertyDirect.end })
  }
  if (propertyShadow) {
    removals.push({ start: propertyShadow.start, end: propertyShadow.end })
  }

  const updatedSchema = removals.length > 0 ? applyRemovals(schemaContent, removals) : schemaContent

  return {
    updatedSchema,
    urlValue,
    shadowValue,
  }
}

function findProperty(
  blockContent: string,
  bodyStart: number,
  propertyName: string,
): { value: string; start: number; end: number } | null {
  const propertyRegex = new RegExp(`^\\s*${propertyName}\\s*=\\s*([^\\r\\n]*)`, 'm')
  const match = propertyRegex.exec(blockContent)
  if (!match || match.index === undefined) {
    return null
  }

  const lineStartInBlock = match.index
  let lineEndInBlock = lineStartInBlock + match[0].length
  if (blockContent[lineEndInBlock] === '\r') {
    lineEndInBlock += 1
  }
  if (blockContent[lineEndInBlock] === '\n') {
    lineEndInBlock += 1
  }

  const rawValue = stripInlineComment(match[1])
  const start = bodyStart + lineStartInBlock
  const end = bodyStart + lineEndInBlock

  return {
    value: rawValue,
    start,
    end,
  }
}

function stripInlineComment(value: string): string {
  const text = value.trim()
  let quote: '"' | "'" | null = null
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quote) {
      if (char === '\\') {
        i += 1
        continue
      }
      if (char === quote) {
        quote = null
      }
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === '/' && text[i + 1] === '/') {
      return text.slice(0, i).trim()
    }
    if (char === '#') {
      return text.slice(0, i).trim()
    }
  }
  return text
}

function parsePrismaValue(value: string): PrismaValue | null {
  const trimmed = value.trim()
  const envMatch = trimmed.match(/^env\(\s*["'`]([A-Za-z0-9_]+)["'`]\s*\)$/)
  if (envMatch) {
    return {
      kind: 'env',
      varName: envMatch[1],
      raw: trimmed,
    }
  }

  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    const quote = trimmed[0] as '"' | "'"
    const inner = trimmed.slice(1, -1)
    return { kind: 'literal', value: inner, quote, raw: trimmed }
  }

  return null
}

function applyRemovals(content: string, segments: Array<{ start: number; end: number }>): string {
  const ordered = segments.slice().sort((a, b) => b.start - a.start)
  let updated = content
  for (const segment of ordered) {
    updated = updated.slice(0, segment.start) + updated.slice(segment.end, updated.length)
  }
  return updated
}

async function configHasJsEngine(configPath: string): Promise<boolean> {
  if (!(await fileExists(configPath))) {
    return false
  }
  const sourceText = await fs.readFile(configPath, 'utf8')
  return getEngineValueFromConfig(sourceText) === 'js'
}

function getEngineValueFromConfig(sourceText: string): string | null {
  const sourceFile = ts.createSourceFile('prisma.config.ts', sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

  let engineValue: string | null = null

  const visit = (node: ts.Node): void => {
    if (engineValue !== null) {
      return
    }

    if (ts.isExportAssignment(node)) {
      const expression = node.expression
      if (
        ts.isCallExpression(expression) &&
        ts.isIdentifier(expression.expression) &&
        expression.expression.text === 'defineConfig' &&
        expression.arguments.length > 0 &&
        ts.isObjectLiteralExpression(expression.arguments[0])
      ) {
        const objectLiteral = expression.arguments[0]
        for (const property of objectLiteral.properties) {
          if (
            ts.isPropertyAssignment(property) &&
            (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
            property.name.text === 'engine' &&
            ts.isStringLiteral(property.initializer)
          ) {
            engineValue = property.initializer.text
            return
          }
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return engineValue
}

async function updateConfigFile(configPath: string, url: PrismaValue, shadow: PrismaValue | null): Promise<boolean> {
  const exists = await fileExists(configPath)
  if (!exists) {
    const template = renderNewConfig(url, shadow)
    await fs.writeFile(configPath, template)
    return true
  }

  const currentContent = await fs.readFile(configPath, 'utf8')
  const updatedContent = updateExistingConfig(currentContent, url, shadow)
  if (updatedContent === null || updatedContent === currentContent) {
    return false
  }

  await fs.writeFile(configPath, updatedContent)
  return true
}

function renderNewConfig(url: PrismaValue, shadow: PrismaValue | null): string {
  const urlExpression = valueToTsExpression(url)
  const shadowLine = shadow ? `\n    shadowDatabaseUrl: ${valueToTsExpression(shadow)},` : ''
  return [
    `import { defineConfig } from '@prisma/config'`,
    ``,
    `export default defineConfig({`,
    `  engine: 'classic',`,
    `  datasource: {`,
    `    url: ${urlExpression},${shadowLine}`,
    `  },`,
    `})`,
    ``,
  ].join('\n')
}

function updateExistingConfig(sourceText: string, url: PrismaValue, shadow: PrismaValue | null): string | null {
  let updated = false
  const sourceFile = ts.createSourceFile('prisma.config.ts', sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    const { factory } = context
    const visit: ts.Visitor = (node) => {
      if (ts.isExportAssignment(node)) {
        const callExpression = node.expression
        if (
          ts.isCallExpression(callExpression) &&
          ts.isIdentifier(callExpression.expression) &&
          callExpression.expression.text === 'defineConfig' &&
          callExpression.arguments.length > 0 &&
          ts.isObjectLiteralExpression(callExpression.arguments[0])
        ) {
          const objectLiteral = callExpression.arguments[0]
          const { updatedObject, changed } = ensureConfigProperties(objectLiteral, url, shadow, factory)

          if (!changed) {
            return node
          }

          updated = true
          const updatedArguments = callExpression.arguments.slice()
          updatedArguments[0] = updatedObject
          const updatedCall = factory.updateCallExpression(
            callExpression,
            callExpression.expression,
            callExpression.typeArguments,
            updatedArguments,
          )
          return factory.updateExportAssignment(node, node.modifiers, updatedCall)
        }
      }
      return ts.visitEachChild(node, visit, context)
    }
    return (node) => ts.visitNode(node, visit)
  }

  const { transformed } = ts.transform(sourceFile, [transformer])
  const transformedFile = transformed[0]

  if (!updated) {
    return sourceText
  }

  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed })
  return printer.printFile(transformedFile as ts.SourceFile)
}

function ensureConfigProperties(
  objectLiteral: ts.ObjectLiteralExpression,
  url: PrismaValue,
  shadow: PrismaValue | null,
  factory: ts.NodeFactory,
): { updatedObject: ts.ObjectLiteralExpression; changed: boolean } {
  let hasEngine = false
  let hasDatasource = false
  let changed = false

  const newProperties: ts.ObjectLiteralElementLike[] = []

  for (const property of objectLiteral.properties) {
    if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) && property.name.text === 'engine') {
      hasEngine = true
      if (ts.isStringLiteral(property.initializer) && property.initializer.text === 'classic') {
        newProperties.push(property)
      } else {
        changed = true
        newProperties.push(
          factory.updatePropertyAssignment(property, property.name, factory.createStringLiteral('classic')),
        )
      }
      continue
    }

    if (
      ts.isPropertyAssignment(property) &&
      (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
      property.name.text === 'datasource'
    ) {
      hasDatasource = true
      const currentInitializer = property.initializer
      const { updatedInitializer, changed: datasourceChanged } = ensureDatasourceProperties(
        currentInitializer,
        url,
        shadow,
        factory,
      )
      if (datasourceChanged) {
        changed = true
        newProperties.push(factory.updatePropertyAssignment(property, property.name, updatedInitializer))
      } else {
        newProperties.push(property)
      }
      continue
    }

    newProperties.push(property)
  }

  if (!hasEngine) {
    changed = true
    newProperties.unshift(
      factory.createPropertyAssignment(factory.createIdentifier('engine'), factory.createStringLiteral('classic')),
    )
  }

  if (!hasDatasource) {
    changed = true
    const datasourceObject = createDatasourceObject(url, shadow, factory)
    const datasourceProperty = factory.createPropertyAssignment(
      factory.createIdentifier('datasource'),
      datasourceObject,
    )
    const insertionIndex = hasEngine ? 1 : 0
    newProperties.splice(insertionIndex, 0, datasourceProperty)
  }

  return {
    changed,
    updatedObject: factory.updateObjectLiteralExpression(objectLiteral, newProperties),
  }
}

function ensureDatasourceProperties(
  initializer: ts.Expression,
  url: PrismaValue,
  shadow: PrismaValue | null,
  factory: ts.NodeFactory,
): { updatedInitializer: ts.ObjectLiteralExpression; changed: boolean } {
  let changed = false
  let obj: ts.ObjectLiteralExpression

  if (ts.isObjectLiteralExpression(initializer)) {
    obj = initializer
  } else {
    changed = true
    obj = factory.createObjectLiteralExpression([], true)
  }

  let hasUrl = false
  let hasShadow = false

  const newProps: ts.ObjectLiteralElementLike[] = []

  for (const prop of obj.properties) {
    if (
      ts.isPropertyAssignment(prop) &&
      (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)) &&
      prop.name.text === 'url'
    ) {
      hasUrl = true
      const expected = valueToTsExpression(url)
      if (prop.initializer.getText().trim() === expected) {
        newProps.push(prop)
      } else {
        changed = true
        newProps.push(factory.updatePropertyAssignment(prop, prop.name, valueToExpression(url, factory)))
      }
      continue
    }

    if (
      ts.isPropertyAssignment(prop) &&
      (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)) &&
      prop.name.text === 'shadowDatabaseUrl'
    ) {
      if (shadow) {
        hasShadow = true
        const expected = valueToTsExpression(shadow)
        if (prop.initializer.getText().trim() === expected) {
          newProps.push(prop)
        } else {
          changed = true
          newProps.push(factory.updatePropertyAssignment(prop, prop.name, valueToExpression(shadow, factory)))
        }
      } else {
        changed = true
        // omit the property since shadow is no longer needed
      }
      continue
    }

    newProps.push(prop)
  }

  if (!hasUrl) {
    changed = true
    newProps.unshift(factory.createPropertyAssignment(factory.createIdentifier('url'), valueToExpression(url, factory)))
  }

  if (shadow && !hasShadow) {
    changed = true
    const insertionIndex = hasUrl ? 1 : newProps.length
    newProps.splice(
      insertionIndex,
      0,
      factory.createPropertyAssignment(
        factory.createIdentifier('shadowDatabaseUrl'),
        valueToExpression(shadow, factory),
      ),
    )
  }

  if (!shadow && hasShadow) {
    changed = true
  }

  if (!changed) {
    return { updatedInitializer: obj, changed: false }
  }

  return {
    changed: true,
    updatedInitializer: factory.updateObjectLiteralExpression(obj, newProps),
  }
}

function createDatasourceObject(
  url: PrismaValue,
  shadow: PrismaValue | null,
  factory: ts.NodeFactory,
): ts.ObjectLiteralExpression {
  const props: ts.ObjectLiteralElementLike[] = [
    factory.createPropertyAssignment(factory.createIdentifier('url'), valueToExpression(url, factory)),
  ]

  if (shadow) {
    props.push(
      factory.createPropertyAssignment(
        factory.createIdentifier('shadowDatabaseUrl'),
        valueToExpression(shadow, factory),
      ),
    )
  }

  return factory.createObjectLiteralExpression(props, true)
}

function valueToExpression(value: PrismaValue, factory: ts.NodeFactory): ts.Expression {
  if (value.kind === 'env') {
    return factory.createPropertyAccessExpression(
      factory.createPropertyAccessExpression(factory.createIdentifier('process'), factory.createIdentifier('env')),
      factory.createIdentifier(value.varName),
    )
  }
  return factory.createStringLiteral(value.value, value.quote === "'")
}

function valueToTsExpression(value: PrismaValue): string {
  if (value.kind === 'env') {
    return `process.env.${value.varName}`
  }
  const quote = value.quote
  return `${quote}${value.value}${quote}`
}

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
