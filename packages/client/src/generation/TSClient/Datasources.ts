import indent from 'indent-string'
import type { Generatable } from './Generatable'
import type { InternalDatasource } from '../../runtime/utils/printDatasources'

export class Datasources implements Generatable {
  constructor(protected readonly internalDatasources: InternalDatasource[]) {}
  public toTS(): string {
    const sources = this.internalDatasources
    return `export type Datasources = {
${indent(sources.map((s) => `${s.name}?: Datasource`).join('\n'), 2)}
}`
  }
}
