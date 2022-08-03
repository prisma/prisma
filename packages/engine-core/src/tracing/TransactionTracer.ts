import { Span } from '@opentelemetry/api'

export interface Child {
  method: string
  model: string
}

export class TransactionTracer {
  children: Child[]

  constructor() {
    this.children = []
  }

  setChild(child: Child) {
    this.children.push(child)
  }

  appendChildren(span: Span) {
    span.setAttribute('children', JSON.stringify(this.children))
  }
}
