export const minimalScript = ({ typescript }: { typescript: boolean }) => `/**
* 
* This code is a start point for you to explore the Photon API.
* Feel free to change it as much as you like or delete it altogether.
*
* Tip: Use the auto-completion of your editor to explore available API operations.
* 
*/

${getImportStatement(typescript)}
const photon = new Photon()

async function main() {
  const result = await photon. // place your cursor here, try the autocompletion
  console.log(result)
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await photon.disconnect()
  })`

const getImportStatement = es6 =>
  es6 ? `import Photon from '@generated/photon'` : `const Photon = require('@generated/photon')`
