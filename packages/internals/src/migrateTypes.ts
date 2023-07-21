// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace MigrateTypes {
  // The URL of the database to run the command on.
  export type UrlContainer = {
    tag: 'ConnectionString'
    url: string
  }
  // Path to the Prisma schema file to take the datasource URL from.
  export type PathContainer = {
    tag: 'SchemaPath'
    path: string
  }
  // Prisma schema as string
  export type SchemaContainer = {
    tag: 'SchemaString'
    schema: string
  }

  export type GetDatabaseVersionParams =
    | {
        datasource: SchemaContainer | UrlContainer | PathContainer
      }
    | undefined
}
