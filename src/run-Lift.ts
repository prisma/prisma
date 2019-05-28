import { Lift } from './Lift'
import path from 'path'

async function main() {
  const lift = new Lift(path.resolve(__dirname, '../examples/blog/'))
  const result = await lift.create()
  console.log(result)
}

main().catch(console.error)
