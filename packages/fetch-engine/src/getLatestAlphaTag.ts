const htmlparser = require('htmlparser2')
const fetch = require('node-fetch')

export async function getLatestAlphaTag() {
  const xml = await fetch('http://prisma-native.s3.amazonaws.com/?list-type=2').then(res => res.text())
  const objects = await getObjects(xml)
  return findLatestAlphaTag(objects)
}

async function getObjects(xml) {
  return new Promise(resolve => {
    const parser = new htmlparser.Parser(
      new htmlparser.DomHandler((err, result) => {
        const bucketTag = result.find(child => child.name === 'listbucketresult')
        resolve(
          bucketTag.children
            .filter(c => c.name === 'contents')
            .map(child => {
              return child.children.reduce((acc, curr) => {
                acc[curr.name] = curr.children[0].data
                return acc
              }, {})
            }),
        )
      }),
    )
    parser.write(xml)
    parser.end()
  })
}

function findLatestAlphaTag(objects) {
  objects.sort((a, b) => {
    // sort  beta to the complete end
    if (!a.key.startsWith('alpha') || a.key.startsWith('alpha/latest')) {
      return 1
    }
    if (!b.key.startsWith('alpha') || b.key.startsWith('alpha/latest')) {
      return -1
    }
    // sort last modified descending
    return new Date(a.lastmodified) < new Date(b.lastmodified) ? 1 : -1
  })
  return objects[0].key.split('/')[1]
}
