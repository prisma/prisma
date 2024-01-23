/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { PrismaClient } from '.prisma/client/edge'
import { PrismaD1 } from '@prisma/adapter-d1'

export interface Env {
	MY_DATABASE: D1Database;
}


export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const adapter = new PrismaD1(env.MY_DATABASE)
		const prisma = new PrismaClient({ adapter })

		// const result = await prisma.$queryRaw`SELECT * from PrismaTest;`
		// console.log({ queryRaw })

		// const result = await prisma.customers.create({
		// 	data: {
		// 		companyName: "Test Company",
		// 		contactName: "Test Contact",
		// 	}
		// })
		// console.log({ create })

		// const result = await prisma.customers.create({
		// 	data: {
		// 		companyName: "Test Company",
		// 		contactName: "Test Contact",
		// 	},
		// 	select: {
		// 		customerId: true,
		// 	}
		// })
		// console.log({ createSelect })

		// const result = await prisma.customers.findMany({
		// 	where: {
		// 		customerId: {
		// 			equals: 1
		// 		}
		// 	}
		// })

		// const result = await prisma.prismaTest.findFirst()

		// const result = await prisma.test.findFirst()

		// const result = await prisma.$executeRaw`
		// 	DELETE FROM Customers
		// `

		// const result = await prisma.test.create({
		// 	data: {
		// 		// id: 1,
		// 		text: "Test name",
		// 		boolean: true,
		// 		blob: new Uint8Array([1, 2, 3]) as Buffer,
		// 		int: 9,
		// 		real: 9.9,
		// 	}
		// })
		
		// const result = await prisma.prismaTest.create({
			// 	data: {
				// 		date: new Date("2019-06-17T14:20:57Z"),
				// 		bigint: Number.MAX_SAFE_INTEGER + 1,
				// 		decimal: 121.10299000124800000001
				// 	}
				// })
				// console.log({ create })

			// const result = await prisma.user.create({
			// 	data: {
			// 		posts: {
			// 			create: [
			// 				{ title: "The fire living beneath your curtains" },
			// 				{ title: "The ocean breeze beneath your feet" },
			// 				{ title: "The starlight beaming afore your eyes" },
			// 			]
			// 		}
			// 	}
			// })

		const result = await prisma.user.findFirst()
				
		console.log('\u2800');
		console.log('\u2800');
		console.log('--- Result from User ----');
		
		console.log({ result })
		await prisma.$disconnect()

		return new Response(`Hello World! Result from Prisma Client from D1!:\n${{result}}, null, 2)}`);
	},
};

