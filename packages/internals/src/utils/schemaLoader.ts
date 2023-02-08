/*
Author: João Victor David de Oliveira (j.victordavid2@gmail.com)
schemaParse.ts (c) 2023
Desc: description
Created:  2023-02-08T11:58:59.566Z
Modified: 2023-02-08T15:59:36.072Z
*/
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)
const existsFile = promisify(fs.exists)

export class SchemaLoader {
  public schemaImportRegex = /^import[^'"]*['"]*([^'"]*)['"].*/gm
  private schemaBreakSplit = '// schema-loader-break\n'
  private schemaPathRegex = /^\/\/ schema-path: ['"]([^'"]*)['"].*$/m
  private schemaImportIgnoreRegex = /^\/\/ schema-import-ignore: (.*)$/gm

  private importedFiles = new Set<string>()

  private async getSchemaData(filePath: string): Promise<string> {
    const schemaBuffer = await readFile(filePath)
    return `${this.schemaBreakSplit}// schema-path: "${filePath}"\n${schemaBuffer.toString('utf-8')}`
  }

  private getSchemaDataSync(filePath: string): string {
    const schemaBuffer = fs.readFileSync(filePath)
    return `${this.schemaBreakSplit}// schema-path: "${filePath}"\n${schemaBuffer.toString('utf-8')}`
  }

  private async loadFile(filePath: string): Promise<string> {
    if (!existsFile(filePath)) throw new Error(`File ${filePath} not found`)
    let schemaData = await this.getSchemaData(filePath)
    const importsFile = schemaData.matchAll(this.schemaImportRegex)
    if (importsFile) {
      for (const importFile of importsFile) {
        const importPath = path.resolve(path.dirname(filePath), importFile[1])
        schemaData = schemaData.replace(importFile[0], `// schema-import-ignore: ${importFile[0]}`)
        if (!this.importedFiles.has(importPath)) {
          this.importedFiles.add(importPath)
          const importData = await this.loadFile(importPath)
          schemaData = schemaData + importData
        }
      }
    }

    return schemaData
  }

  private loadFileSync(filePath: string): string {
    let schemaData = this.getSchemaDataSync(filePath)
    const importsFile = schemaData.matchAll(this.schemaImportRegex)
    if (importsFile) {
      for (const importFile of importsFile) {
        const importPath = path.resolve(path.dirname(filePath), importFile[1])
        schemaData = schemaData.replace(importFile[0], `// schema-import-ignore: ${importFile[0]}`)
        if (!this.importedFiles.has(importPath)) {
          this.importedFiles.add(importPath)
          const importData = this.loadFileSync(importPath)
          schemaData = schemaData + importData
        }
      }
    }

    return schemaData
  }

  public load(filePath: string): Promise<string> {
    filePath = path.resolve(__dirname, filePath)
    if (!existsFile(filePath)) throw new Error(`File ${filePath} not found`)

    const result = this.loadFile(filePath)
    this.importedFiles.clear()
    return result
  }

  public async loadBuffer(filePath: string): Promise<Buffer> {
    return Buffer.from(await this.load(filePath))
  }

  public loadSync(filePath: string): string {
    filePath = path.resolve(__dirname, filePath)
    if (!existsFile(filePath)) throw new Error(`File ${filePath} not found`)

    const result = this.loadFileSync(filePath)
    this.importedFiles.clear()
    return result
  }

  public loadBufferSync(filePath: string): Buffer {
    return Buffer.from(this.loadSync(filePath))
  }

  private async saveFile(schemaData: string): Promise<void> {
    const schemaFiles = schemaData.split(this.schemaBreakSplit)
    for (let schemaFile of schemaFiles) {
      const schemaPath = schemaFile.match(this.schemaPathRegex)
      if (schemaPath) {
        schemaFile = schemaFile.replace(schemaPath[0] + '\n', '')
        const schemaPathFile = schemaPath[1]
        const schemaImportsIgnore = schemaFile.matchAll(this.schemaImportIgnoreRegex)
        for (const schemaImportIgnore of schemaImportsIgnore) {
          schemaFile = schemaFile.replace(schemaImportIgnore[0], schemaImportIgnore[1].trim())
        }
        await writeFile(schemaPathFile, schemaFile)
      }
    }
  }

  private saveFileSync(schemaData: string): void {
    const schemaFiles = schemaData.split(this.schemaBreakSplit)
    for (let schemaFile of schemaFiles) {
      const schemaPath = schemaFile.match(this.schemaPathRegex)
      if (schemaPath) {
        schemaFile = schemaFile.replace(schemaPath[0] + '\n', '')
        const schemaPathFile = schemaPath[1]
        const schemaImportsIgnore = schemaFile.matchAll(this.schemaImportIgnoreRegex)
        for (const schemaImportIgnore of schemaImportsIgnore) {
          schemaFile = schemaFile.replace(schemaImportIgnore[0], schemaImportIgnore[1].trim())
        }
        fs.writeFileSync(schemaPathFile, schemaFile, {
          encoding: 'utf-8',
        })
      }
    }
  }

  public save(schemaData: string): Promise<void> {
    return this.saveFile(schemaData)
  }

  public saveSync(schemaData: string): void {
    return this.saveFileSync(schemaData)
  }
}
