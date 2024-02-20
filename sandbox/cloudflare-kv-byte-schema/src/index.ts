import { PrismaClient } from 'prisma-client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

export interface Env {
	PRISMA_KV: KVNamespace
	DATABASE_URL: string
}

let serializedSchema: Uint8Array | null = null

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const { PRISMA_KV, DATABASE_URL } = env

		if (serializedSchema === null) {
			const serializedSchemaBuffer = await PRISMA_KV.get('prisma:schema', 'arrayBuffer')
			if (serializedSchemaBuffer === null) {
				return new Response('Serialized schema not found on KV', { status: 404 })
			}

			serializedSchema = new Uint8Array(serializedSchemaBuffer!)
		}

		const pool = new Pool({ connectionString: DATABASE_URL })
		const adapter = new PrismaPg(pool)

		const prisma = new PrismaClient({
			adapter,

			// @ts-ignore
			serializedSchema,
		})

		const users = await prisma.user.findMany()

		const json = {
			users,
		}

		return new Response(JSON.stringify(json, null, 2), {
			headers: { 'content-type': 'application/json' },
		})
	},
};
