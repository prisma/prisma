import {
  GetConfigOptions,
  ConfigMetaFormat,
  QueryEngineConfig,
} from '../../common/types/QueryEngine'

export type ConnectArgs = {
  enableRawQueries: boolean
}

export type QueryEngineInstance = {
  connect(connectArgs: ConnectArgs): Promise<void>
  disconnect(): Promise<void>
  /**
   *
   * @param request JSON.stringified `QueryEngineRequest | QueryEngineBatchRequest`
   *
   * @param headers JSON.stringified `QueryEngineRequestHeaders`
   */
  query(request: string, headers: string): Promise<string>
  sdlSchema(): Promise<string>
  startTransaction(options: string): Promise<string>
  commitTransaction(id: string): Promise<string>
  rollbackTransaction(id: string): Promise<string>
}

export interface QueryEngineConstructor {
  new (
    config: QueryEngineConfig,
    logger: (err: string, log: string) => void,
  ): QueryEngineInstance
}

// Main
export type Library = {
  QueryEngine: QueryEngineConstructor
  version: () => {
    commit: string
    version: string
  }
  getConfig: (options: GetConfigOptions) => Promise<ConfigMetaFormat>
  /**
   * This returns a string representation of `DMMF.Document`
   */
  dmmf: (datamodel: string) => Promise<string>
}
