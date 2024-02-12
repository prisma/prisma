/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { PrismaClient } from 'db'
import { PrismaD1 } from '@prisma/adapter-d1'

export interface Env {
	MY_DATABASE: D1Database;
}


export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const adapter = new PrismaD1(env.MY_DATABASE)
		const prisma = new PrismaClient({ adapter })

		// const queryRaw = await prisma.$queryRaw`SELECT * from Customers;`
		// console.log({ queryRaw })

		// const create = await prisma.customers.create({
		// 	data: {
		// 		companyName: "Test Company",
		// 		contactName: "Test Contact",
		// 	}
		// })
		// console.log({ create })

		// const createSelect = await prisma.customers.create({
		// 	data: {
		// 		companyName: "Test Company",
		// 		contactName: "Test Contact",
		// 	},
		// 	select: {
		// 		customerId: true,
		// 	}
		// })
		// console.log({ createSelect })

		// const findMany = await prisma.customers.findMany({
		// 	where: {
		// 		customerId: {
		// 			equals: 1
		// 		}
		// 	}
		// })

		// const deleteEx = await prisma.$executeRaw`
		// 	DELETE FROM Customers
		// `

		await prisma.$transaction([
			prisma.customers.create({
				data: { customerId: 3, companyName: "The Sith", contactName: "Vader" }
			}),
			prisma.customers.create({
				data: { customerId: 508, companyName: "Blaze Away", contactName: "LonDone" }
			}),
		])

		await prisma.$transaction([
			prisma.customers.create({
				data: { customerId: 420, companyName: "Sky High", contactName: "Bush" }
			})
		])

		const result = await prisma.customers.findMany()

		await prisma.$disconnect()

		return new Response(`Hello World! Result from Prisma Client from D1!:\n${JSON.stringify(result, null, 2)}`);
	},
};

