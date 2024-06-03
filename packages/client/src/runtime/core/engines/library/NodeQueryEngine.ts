import { Query } from './Query'

export class NodeQueryEngine {
  libraryEngine: any

  constructor(libraryEngine) {
    this.libraryEngine = libraryEngine
  }

  async execute(_query) {
    const datamodel = this.libraryEngine.config._runtimeDataModel
    const client = this.libraryEngine.adapter

    const query = new Query(_query, datamodel, client, this.libraryEngine)

    query.validate()
    const result = await query.process()
    return result
  }
}
