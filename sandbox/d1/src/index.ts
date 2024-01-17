/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

// Note: see wrangler.toml and https://www.npmjs.com/package/@cloudflare/workers-types for the version
/// <reference types="@cloudflare/workers-types" />

// TODO
// import { PrismaClient } from '@prisma/client/edge'
import { PrismaClient } from '.prisma/client'
// import { PrismaD1 } from '@prisma/adapter-d1'

export interface Env {
	MY_DATABASE: D1Database;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		console.debug({db: env.MY_DATABASE})

		// const adapter = new PrismaD1(env.MY_DATABASE)
		// const prisma = new PrismaClient({ adapter })
		// const result = await prisma.$executeRaw`SELECT 1;`

		const result = await env.MY_DATABASE.exec("SELECT 1;")

		return new Response(`Hello World! SQL Result from D1 API: ${JSON.stringify(result)}`);
	},
};

