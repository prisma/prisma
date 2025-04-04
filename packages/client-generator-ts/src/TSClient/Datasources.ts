import { DataSource } from '@prisma/generator'
import indent from 'indent-string'

export class Datasources {
  constructor(protected readonly internalDatasources: DataSource[]) {}
  public toTS(): string {
    const sources = this.internalDatasources
    return `
export type Datasource = {
  url?: string
}
export type Datasources = {
${indent(sources.map((s) => `${s.name}?: Datasource`).join('\n'), 2)}
}
`
  }
}
