import indent from 'indent-string'

import type { InternalDatasource } from '../../runtime/utils/printDatasources'
import type { Generatable } from './Generatable'

export class Datasources implements Generatable {
  constructor(protected readonly internalDatasources: InternalDatasource[]) {}
  public toTS(): string {
    const sources = this.internalDatasources
    return `export type Datasources = {
${indent(sources.map((s) => `${s.name}?: Datasource`).join('\n'), 2)}
}`
  }
}
