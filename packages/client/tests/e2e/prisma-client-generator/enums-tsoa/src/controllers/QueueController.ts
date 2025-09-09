import { Controller, Get, Route } from 'tsoa'

import { PrismaClient, QuoteKind } from '../generated/prisma/client'

type MyQuote = {
  content: string
  kind: QuoteKind
}

@Route('quotes')
export class QuotesController extends Controller {
  @Get('/')
  public async getQuotes(): Promise<MyQuote[]> {
    const prisma = new PrismaClient()

    const quotes = await prisma.quote.findMany()
    return quotes.map((quote) => ({
      content: quote.content,
      kind: quote.kind,
    }))
  }
}
