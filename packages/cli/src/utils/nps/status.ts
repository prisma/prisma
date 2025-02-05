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

  checkSchema(obj: any): obj is NpsStatus {
    return (
      obj.currentTimeframe == null ||
      (typeof obj.currentTimeframe.start === 'string' && typeof obj.currentTimeframe.end === 'string')
    )
  }
}
