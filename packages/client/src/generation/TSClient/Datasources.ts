import type { DataSource } from '@prisma/generator-helper'
import indent from 'indent-string'

import type { Generable } from './Generable'

export class Datasources implements Generable {
  constructor(protected readonly internalDatasources: DataSource[]) {}
  public toTS(): string {
    const sources = this.internalDatasources
    return `export type Datasources = {
${indent(sources.map((s) => `${s.name}?: Datasource`).join('\n'), 2)}
}`
  }
}
