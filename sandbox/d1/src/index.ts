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
  MY_DATABASE: D1Database
}

declare global {
  var DEBUG: undefined | string
}

globalThis.DEBUG = '*'

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const adapter = new PrismaD1(env.MY_DATABASE)
    const prisma = new PrismaClient({ adapter })

    let tenc = new TextEncoder()
    let buffer = tenc.encode('Hello')

    // let buffer = Uint8Array.from(['H', 'e', 'l', 'l', 'o'])

    const qr = await prisma.$queryRaw`
		INSERT INTO "Test"
			("boolean", "blob")
			VALUES (true, ${buffer})
			RETURNING *
		`
    console.log({ qr })

    console.log('--------')

    // const result = await prisma.test.findUnique({
    // 	where: {
    // 		id: qr.re
    // 	}
    // })

    // const result = await prisma.customers.create({
    // 	data: {
    // 		companyName: "Test Company",
    // 		contactName: "Test Contact",
    // 	}
    // })

    // const result = await prisma.customers.create({
    // 	data: {
    // 		companyName: "Test Company",
    // 		contactName: "Test Contact",
    // 	},
    // 	select: {
    // 		customerId: true,
    // 	}
    // })

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
    // 		blob: new Uint8Array([1, 2, 3]),
    // 		int: 9,
    // 		real: 9.9,
    // 	}
    // })

    // const result = await prisma.prismaTest.create({
    // 		data: {
    // 				date: new Date("2019-06-17T14:20:57Z"),
    // 				bigint: Number.MAX_SAFE_INTEGER + 1,
    // 				decimal: 121.10299000124800000001
    // 			}
    // 		})

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

    // await prisma.$transaction([
    // 	prisma.customers.create({
    // 		data: { customerId: 3, companyName: "The Sith", contactName: "Vader" }
    // 	}),
    // 	prisma.customers.create({
    // 		data: { customerId: 508, companyName: "Blaze Away", contactName: "LonDone" }
    // 	}),
    // ])

    // await prisma.$transaction([
    // 	prisma.customers.create({
    // 		data: { customerId: 420, companyName: "Sky High", contactName: "Bush" }
    // 	})
    // ])

    // const result = await prisma.customers.findMany()
    // // const result = await prisma.user.findFirst()

    // console.log('\u2800');
    // console.log('\u2800');
    // console.log('--- Result from User ----');

    // console.log(typeof result.blob)
    // console.log(typeof buffer)
    // console.log({ result })
    // await prisma.$disconnect()

    return new Response(`Hello World! Result from Prisma Client from D1!:\n${JSON.stringify(result, null, 2)}`)
  },
}
