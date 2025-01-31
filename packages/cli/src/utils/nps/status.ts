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

const npsStatusUrl = new URL(
  'https://raw.githubusercontent.com/jacek-prisma/nps-timeframe/refs/heads/main/timeframe.json',
)

export class ProdNpsStatusLookup implements NpsStatusLookup {
  async status(): Promise<NpsStatus> {
    const resp = await fetch(npsStatusUrl.href)
    return await (resp.ok
      ? ((await resp.json()) as NpsStatus)
      : Promise.reject(new Error(`Failed to fetch NPS survey status: ${resp.statusText}`)))
  }
}
