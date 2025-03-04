export type NpsStatus = {
  currentTimeframe?: Timeframe
}

export type Timeframe = {
  start: string
  end: string
}

export interface NpsStatusLookup {
  status: () => Promise<NpsStatus>
}

const npsStatusUrl = new URL('https://pub-833f4cf4b3dc4d17a6db4981affc9fbb.r2.dev/timeframe.json')

export class ProdNpsStatusLookup implements NpsStatusLookup {
  async status(): Promise<NpsStatus> {
    const resp = await fetch(npsStatusUrl.href)

    if (resp.status === 404) {
      return {}
    }
    if (!resp.ok) {
      throw new Error(`Failed to fetch NPS survey status: ${resp.statusText}`)
    }

    const obj = await resp.json()
    if (!this.checkSchema(obj)) {
      throw new Error('Invalid NPS status schema')
    }
    return obj
  }

  checkSchema(obj: unknown): obj is NpsStatus {
    if (typeof obj !== 'object' || obj === null) {
      return false
    }

    const candidate = obj as Record<string, unknown>

    if (candidate.currentTimeframe === undefined || candidate.currentTimeframe === null) {
      return true
    }

    if (typeof candidate.currentTimeframe !== 'object' || candidate.currentTimeframe === null) {
      return false
    }

    const timeframe = candidate.currentTimeframe as Record<string, unknown>
    return typeof timeframe.start === 'string' && typeof timeframe.end === 'string'
  }
}
