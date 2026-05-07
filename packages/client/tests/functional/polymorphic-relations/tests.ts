import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {

  test('create vote on a Post', async () => {
    const post = await prisma.post.create({
      data: {
        title: 'Test Post',
      },
    })

    const vote = await prisma.vote.create({
      data: {
        value: 1,
        itemId: post.id,
        itemType: 'Post',
      },
    })

    expect(vote.itemType).toBe('Post')
    expect(vote.itemId).toBe(post.id)
  })

  test('create vote on a Comment', async () => {
    const comment = await prisma.comment.create({
      data: {
        body: 'Test Comment',
      },
    })

    const vote = await prisma.vote.create({
      data: {
        value: 1,
        itemId: comment.id,
        itemType: 'Comment',
      },
    })

    expect(vote.itemType).toBe('Comment')
    expect(vote.itemId).toBe(comment.id)
  })

  test('read polymorphic relation as union type', async () => {
    const post = await prisma.post.create({
      data: {
        title: 'Test Post',
      },
    })

    const vote = await prisma.vote.create({
      data: {
        value: 1,
        itemId: post.id,
        itemType: 'Post',
      },
    })

    const result = await prisma.vote.findUnique({
      where: { id: vote.id },
      include: {
        item: true,
      },
    })

    expect(result).not.toBeNull()
    expect(result!.item).toBeDefined()
  })

  test('read polymorphic relation with on filter', async () => {
    const post = await prisma.post.create({
      data: {
        title: 'Test Post',
      },
    })

    const vote = await prisma.vote.create({
      data: {
        value: 1,
        itemId: post.id,
        itemType: 'Post',
      },
    })

    const result = await prisma.vote.findUnique({
      where: { id: vote.id },
      include: {
        item: { on: 'Post' },
      },
    })

    expect(result).not.toBeNull()
    expect(result!.item).not.toBeNull()
  })

  test('list all votes and their polymorphic relations', async () => {
    const post = await prisma.post.create({
      data: {
        title: 'Test Post',
      },
    })

    await prisma.vote.create({
      data: {
        value: 1,
        itemId: post.id,
        itemType: 'Post',
      },
    })

    const comment = await prisma.comment.create({
      data: {
        body: 'Test Comment',
      },
    })

    await prisma.vote.create({
      data: {
        value: 1,
        itemId: comment.id,
        itemType: 'Comment',
      },
    })

    const votes = await prisma.vote.findMany({
      include: {
        item: true,
      },
      orderBy: {
        id: 'asc',
      },
    })

    expect(votes).toHaveLength(2)
  })

  test('filter by discriminator column', async () => {
    const post = await prisma.post.create({
      data: {
        title: 'Test Post',
      },
    })

    await prisma.vote.create({
      data: {
        value: 1,
        itemId: post.id,
        itemType: 'Post',
      },
    })

    const comment = await prisma.comment.create({
      data: {
        body: 'Test Comment',
      },
    })

    await prisma.vote.create({
      data: {
        value: 1,
        itemId: comment.id,
        itemType: 'Comment',
      },
    })

    const postVotes = await prisma.vote.findMany({
      where: {
        itemType: 'Post',
      },
      include: {
        item: true,
      },
    })

    expect(postVotes).toHaveLength(1)
    expect(postVotes[0].itemType).toBe('Post')
  })

  test('update vote to change polymorphic relation', async () => {
    const post = await prisma.post.create({
      data: {
        title: 'Test Post',
      },
    })

    const vote = await prisma.vote.create({
      data: {
        value: 1,
        itemId: post.id,
        itemType: 'Post',
      },
    })

    expect(vote.itemType).toBe('Post')

    const comment = await prisma.comment.create({
      data: {
        body: 'Test Comment',
      },
    })

    const updatedVote = await prisma.vote.update({
      where: { id: vote.id },
      data: {
        itemId: comment.id,
        itemType: 'Comment',
      },
    })

    expect(updatedVote.itemType).toBe('Comment')
    expect(updatedVote.itemId).toBe(comment.id)
  })

  test('delete post does not cascade to vote by default', async () => {
    const post = await prisma.post.create({
      data: {
        title: 'Test Post',
      },
    })

    const vote = await prisma.vote.create({
      data: {
        value: 1,
        itemId: post.id,
        itemType: 'Post',
      },
    })

    await prisma.post.delete({
      where: { id: post.id },
    })

    // Polymorphic relations have no FK constraint, so the vote still exists
    const remainingVote = await prisma.vote.findUnique({
      where: { id: vote.id },
    })

    expect(remainingVote).not.toBeNull()
  })
})
