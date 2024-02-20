// node ./prepare.js

import fs from 'node:fs/promises'
import { CloudflareApi } from '@orama/cloudflare-api'
import { createHash } from 'sha256-uint8array'

const serializedSchema = await fs.readFile('./prisma/client/schema.bin')
const originalHash = createHash().update(serializedSchema).digest('hex')

const {
  CLOUDFLARE_API_TOKEN,
  CLOUDFLARE_ACCOUNT_ID,
  CLOUDFLARE_KV_NAMESPACE_ID,         // used in production, after `wrangler publish`
  CLOUDFLARE_KV_PREVIEW_NAMESPACE_ID, // used locally with `wrangler dev`
} = process.env

async function main() {
  const api = new CloudflareApi({ apiKey: CLOUDFLARE_API_TOKEN })
  
  console.log('[Preview]')
  await uploadToKV(CLOUDFLARE_KV_PREVIEW_NAMESPACE_ID, api)

  console.log('[Production]')
  await uploadToKV(CLOUDFLARE_KV_NAMESPACE_ID, api)
}

main()

async function uploadToKV(namespaceId, api) {
  console.log('Namespace ID', namespaceId)
  const kvAPI = api.workerKv(CLOUDFLARE_ACCOUNT_ID, namespaceId)
  
  console.log('🚀 Uploading schema to Cloudflare KV...')
  
  // upload the binary schema to Cloudflare KV
  await kvAPI.uploadKv('prisma:schema', new Blob([serializedSchema.buffer]))
  
  console.log('✅ Schema uploaded to Cloudflare KV!')
  
  // retrieve the binary schema from Cloudflare KV
  const retrievedSchemaBuffer = await kvAPI.getKv('prisma:schema', 'arrayBuffer')
  const retrievedSchema = new Uint8Array(retrievedSchemaBuffer)
  
  console.log('✅ Schema retrieved from Cloudflare KV!')
  
  const retrievedHash = createHash().update(retrievedSchema).digest('hex')
  
  if (originalHash !== retrievedHash) {
    throw new Error('The uploaded schema does not match the original schema!')
  }
  
  console.log('✅ The retrieved schema matches the previously uploaded schema!')
  console.log('')
}
