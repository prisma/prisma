export type ConnectorType = 'mysql' | 'mongo' | 'sqlite' | 'postgresql'

export interface DataSource {
  name: string
  connectorType: ConnectorType
  url: string
  config: {}
}
