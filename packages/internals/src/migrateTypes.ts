// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace MigrateTypes {
  export type SchemaContainer = {
    path: string
    content: string
  }

  export type SchemasContainer = {
    files: SchemaContainer[]
  }

  export type SchemasWithConfigDir = {
    files: SchemaContainer[]
    configDir: string
  }

  export type UrlContainer = {
    url: string
  }

  export type DatasourceParam = Tagged<'ConnectionString', UrlContainer> | Tagged<'Schema', SchemasContainer>
  export type GetDatabaseVersionParams = {
    datasource: MigrateTypes.DatasourceParam
  }

  // Helper type for creating tagged enum variants
  export type Tagged<Tag extends string, T> = Display<{ tag: Tag } & T>

  // Helper to force TS to display the fields of computed types, rather than type name
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  export type Display<T> = { [K in keyof T]: T[K] } & unknown
}
