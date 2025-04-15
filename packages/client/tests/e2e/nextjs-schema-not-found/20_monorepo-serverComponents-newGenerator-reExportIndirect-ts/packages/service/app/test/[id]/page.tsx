import { db } from 'db'

type Params = {
  id: string
}

export function generateStaticParams(): Promise<Params[]> {
  return Promise.resolve([{ id: '1' }])
}

async function doPrismaQuery(params: Params) {
  if (params.id === '1') return JSON.stringify({})

  const result = await db.$queryRaw`SELECT 1`
  return JSON.stringify(result)
}

type Props = {
  params: Params
}

export default async function Page({ params }: Props) {
  return <div>{await doPrismaQuery(params)}</div>
}
