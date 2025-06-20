import { CompositeType } from './composite-type'
import { Enum } from './enum'
import { Model } from './model'
import { View } from './view'

/**
 * Configuration section (generators and datasources) - placeholder for now
 */
export interface Configuration {
  generators: Map<string, any[]>
  datasources: Map<string, any[]>
}

/**
 * A rendered source file with its content.
 */
export interface SourceFile {
  content: string
}

/**
 * The PSL data model declaration.
 * Equivalent to Rust's Datamodel<'a> struct.
 */
export class Datamodel {
  private models: Map<string, Model[]> = new Map()
  private views: Map<string, View[]> = new Map()
  private enums: Map<string, Enum[]> = new Map()
  private compositeTypes: Map<string, CompositeType[]> = new Map()
  private configuration?: Configuration

  /**
   * Create a new empty data model.
   */
  constructor() {}

  /**
   * Add a model block to the data model.
   */
  public pushModel(file: string, model: Model): this {
    if (!this.models.has(file)) {
      this.models.set(file, [])
    }
    this.models.get(file)!.push(model)
    return this
  }

  /**
   * Add an enum block to the data model.
   */
  public pushEnum(file: string, enumDef: Enum): this {
    if (!this.enums.has(file)) {
      this.enums.set(file, [])
    }
    this.enums.get(file)!.push(enumDef)
    return this
  }

  /**
   * Add a view block to the data model.
   */
  public pushView(file: string, view: View): this {
    if (!this.views.has(file)) {
      this.views.set(file, [])
    }
    this.views.get(file)!.push(view)
    return this
  }

  /**
   * Add a composite type block to the data model.
   */
  public pushCompositeType(file: string, compositeType: CompositeType): this {
    if (!this.compositeTypes.has(file)) {
      this.compositeTypes.set(file, [])
    }
    this.compositeTypes.get(file)!.push(compositeType)
    return this
  }

  /**
   * True if the render output would be an empty string.
   */
  public isEmpty(): boolean {
    return this.models.size === 0 && this.enums.size === 0 && this.compositeTypes.size === 0 && this.views.size === 0
  }

  /**
   * Renders the datamodel into a list of file names and their content.
   */
  public render(): Array<[string, SourceFile]> {
    const rendered: Map<string, string> = new Map()

    // Render configuration if present
    if (this.configuration) {
      for (const [file, generators] of this.configuration.generators) {
        let generatorStr = rendered.get(file) || ''
        for (const generator of generators) {
          generatorStr += `${generator}\n`
        }
        rendered.set(file, generatorStr)
      }

      for (const [file, datasources] of this.configuration.datasources) {
        let datasourceStr = rendered.get(file) || ''
        for (const datasource of datasources) {
          datasourceStr += `${datasource}\n`
        }
        rendered.set(file, datasourceStr)
      }
    }

    // Render composite types
    for (const [file, compositeTypes] of this.compositeTypes) {
      let compositeTypeStr = rendered.get(file) || ''
      for (const compositeType of compositeTypes) {
        compositeTypeStr += `${compositeType.toString()}\n`
      }
      rendered.set(file, compositeTypeStr)
    }

    // Render models
    for (const [file, models] of this.models) {
      let modelStr = rendered.get(file) || ''
      for (const model of models) {
        modelStr += `${model.toString()}\n`
      }
      rendered.set(file, modelStr)
    }

    // Render views
    for (const [file, views] of this.views) {
      let viewStr = rendered.get(file) || ''
      for (const view of views) {
        viewStr += `${view.toString()}\n`
      }
      rendered.set(file, viewStr)
    }

    // Render enums
    for (const [file, enums] of this.enums) {
      let enumStr = rendered.get(file) || ''
      for (const enumDef of enums) {
        enumStr += `${enumDef.toString()}\n`
      }
      rendered.set(file, enumStr)
    }

    // Convert to array of tuples with SourceFile objects
    return Array.from(rendered.entries()).map(([file, content]) => [
      file,
      { content: content.trim() + (content.trim() ? '\n' : '') },
    ])
  }

  /**
   * Sets the configuration blocks for a datamodel.
   */
  public setConfiguration(config: Configuration): this {
    this.configuration = config
    return this
  }

  public static create(): Datamodel {
    return new Datamodel()
  }

  public getModels(): ReadonlyMap<string, readonly Model[]> {
    return this.models
  }

  public getViews(): ReadonlyMap<string, readonly View[]> {
    return this.views
  }

  public getEnums(): ReadonlyMap<string, readonly Enum[]> {
    return this.enums
  }

  public getCompositeTypes(): ReadonlyMap<string, readonly CompositeType[]> {
    return this.compositeTypes
  }
}
