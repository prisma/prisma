const htmlparser = require('htmlparser2')
const fetch = require('node-fetch')
const { getProxyAgent } = require('./getProxyAgent')

export async function getLatestAlphaTag() {
  const objects = []
  let isTruncated: boolean = false
  let nextContinuationToken: string | undefined = undefined

  do {
    const url = getUrl(nextContinuationToken)
    const xml = await fetch(url, { agent: getProxyAgent(url) }).then(res => res.text())
    const result = await getObjects(xml)
    isTruncated = result.isTruncated
    nextContinuationToken = result.nextContinuationToken
    objects.push(...result.objects)
  } while (isTruncated && nextContinuationToken)

  return findLatestAlphaTag(objects)
}

function getUrl(nextContinuationToken?: string) {
  let url = 'http://prisma-native.s3.amazonaws.com/?list-type=2&prefix=master'

  if (nextContinuationToken) {
    url += `&continuation-token=${encodeURIComponent(nextContinuationToken)}`
  }

  return url
}

async function getObjects(
  xml,
): Promise<{ objects: Array<any>; isTruncated: boolean; nextContinuationToken: string | null }> {
  return new Promise(resolve => {
    const parser = new htmlparser.Parser(
      new htmlparser.DomHandler((err, result) => {
        const bucketTag = result.find(child => child.name === 'listbucketresult')
        if (!bucketTag) {
          resolve({ objects: [], isTruncated: false, nextContinuationToken: null })
        }
        const isTruncated = getKey(bucketTag, 'istruncated')
        const nextContinuationToken = getKey(bucketTag, 'nextcontinuationtoken')
        resolve({
          objects: bucketTag.children
            .filter(c => c.name === 'contents')
            .map(child => {
              return child.children.reduce((acc, curr) => {
                acc[curr.name] = curr.children[0].data
                return acc
              }, {})
            }),
          isTruncated,
          nextContinuationToken,
        })
      }),
    )
    parser.write(xml)
    parser.end()
  })
}

function findLatestAlphaTag(objects) {
  // look for the darwin build, as it always finishes last
  objects = objects.filter(o => o.key.includes('darwin'))
  objects.sort((a, b) => {
    // sort  beta to the complete end
    if (!a.key.startsWith('master') || a.key.startsWith('master/latest')) {
      return 1
    }
    if (!b.key.startsWith('master') || b.key.startsWith('master/latest')) {
      return -1
    }
    // sort last modified descending
    return new Date(a.lastmodified) < new Date(b.lastmodified) ? 1 : -1
  })
  return objects[0].key.split('/')[1]
}

function getKey(parentTag, key) {
  if (!parentTag) {
    return null
  }
  const tag = parentTag.children.find(c => c.name === key)
  if (tag) {
    return serializeTag(tag)
  }

  return null
}

function serializeTag(tag) {
  if (tag.children) {
    return tag.children
      .map(c => {
        if (typeof c.data !== 'undefined') {
          return serializeData(c.data)
        }
        if (c.children) {
          return serializeTag(c)
        }
        return null
      })
      .join('')
  }
  return null
}

function serializeData(data) {
  if (data === 'false') {
    return false
  }

  if (data === 'true') {
    return true
  }

  return data
}
