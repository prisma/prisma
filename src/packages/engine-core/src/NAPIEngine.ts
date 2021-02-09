import {
  Engine,
  EngineConfig,
  EngineEventType,
  GetConfigResult,
} from './Engine'

export class NAPIEngine implements Engine {
  constructor(private config: EngineConfig) {}
  on(event: EngineEventType, listener: (args?: any) => any): void {}
  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  kill(signal: string): void {}
  async getConfig(): Promise<GetConfigResult> {
    return null as any
  }
  async version(forceRun?: boolean): Promise<string> {
    return 'version'
  }
  async internalVersion(): Promise<string> {
    return 'internalVersion'
  }
  async request<T>(
    query: string,
    headers: Record<string, string>,
    numTry: number,
  ): Promise<T> {
    return {} as T
  }
  async requestBatch<T>(
    queries: string[],
    transaction?: boolean,
    numTry?: number,
  ): Promise<T> {
    return {} as T
  }
}
