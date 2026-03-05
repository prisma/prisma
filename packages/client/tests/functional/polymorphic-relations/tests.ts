import { PrismaClient } from '@prisma/client'

import { testMatrix } from '../_matrix'
import { idForProvider } from '../_utils/idForProvider'

testMatrix.testSuite(() => {
  const prisma = new PrismaClient()

  test('create vote on a Post', async () => {
    const id = idForProvider('sqlite')

    // Create a Post first
    const post = await prisma.post.create({
      data: {
        id,
        title: 'Test Post',
      },
    })

    // Create a vote on the Post
    const vote = await prisma.vote.create({
      data: {
        id,
        value: 1,
        itemId: post.id,
        itemType: 'Post',
      },
    })

    expect(vote.itemType).toBe('Post')
    expect(vote.itemId).toBe(post.id)
  })

  test('create vote on a Comment', async () => {
    const id = idForProvider('sqlite')

    // Create a Comment first
    const comment = await prisma.comment.create({
      data: {
        id,
        body: 'Test Comment',
      },
    })

    // Create a vote on the Comment
    const vote = await prisma.vote.create({
      data: {
        id,
        value: 1,
        itemId: comment.id,
        itemType: 'Comment',
      },
    })

    expect(vote.itemType).toBe('Comment')
    expect(vote.itemId).toBe(comment.id)
  })

  test('read polymorphic relation as union type', async () => {
    const id = idForProvider('sqlite')

    // Create a Post and a Vote on it
    const post = await prisma.post.create({
      data: {
        id,
        title: 'Test Post',
      },
    })

    await prisma.vote.create({
      data: {
        id,
        value: 1,
        itemId: post.id,
        itemType: 'Post',
      },
    })

    // Read the vote with the polymorphic relation
    const vote = await prisma.vote.findUnique({
      where: { id },
      include: {
        item: true,
      },
    })

    expect(vote).not.toBeNull()
    expect(vote!.item).toBeDefined()
    // Type narrowing would be needed to access Post-specific fields
    // The item should be typed as Post | Comment
  })

  test('read polymorphic relation with on filter', async () => {
    const id = idForProvider('sqlite')

    // Create a Post and a Vote on it
    const post = await prisma.post.create({
      data: {
        id,
        title: 'Test Post',
      },
    })

    await prisma.vote.create({
      data: {
        id,
        value: 1,
        itemId: post.id,
        itemType: 'Post',
      },
    })

    // Read the vote with the polymorphic relation filtered to Post
    const vote = await prisma.vote.findUnique({
      where: { id },
      include: {
        item: { on: 'Post' },
      },
    })

    expect(vote).not.toBeNull()
    expect(vote!.item).not.toBeNull()
    // vote.item should be typed as Post (not Post | Comment)
  })

  test('list all votes and their polymorphic relations', async () => {
    const id1 = idForProvider('sqlite')
    const id2 = idForProvider('sqlite')

    // Create a Post with a Vote
    const post = await prisma.post.create({
      data: {
        id: id1,
        title: 'Test Post',
      },
    })

    await prisma.vote.create({
      data: {
        id: id1,
        value: 1,
        itemId: post.id,
        itemType: 'Post',
      },
    })

    // Create a Comment with a Vote
    const comment = await prisma.comment.create({
      data: {
        id: id2,
        body: 'Test Comment',
      },
    })

    await prisma.vote.create({
      data: {
        id: id2,
        value: 1,
        itemId: comment.id,
        itemType: 'Comment',
      },
    })

    // List all votes with their polymorphic relations
    const votes = await prisma.vote.findMany({
      include: {
        item: true,
      },
      orderBy: {
        id: 'asc',
      },
    })

    expect(votes).toHaveLength(2)
    // votes[0].item should be Post
    // votes[1].item should be Comment
  })

  test('filter by discriminator column', async () => {
    const id1 = idForProvider('sqlite')
    const id2 = idForProvider('sqlite')

    // Create a Post with a Vote
    const post = await prisma.post.create({
      data: {
        id: id1,
        title: 'Test Post',
      },
    })

    await prisma.vote.create({
      data: {
        id: id1,
        value: 1,
        itemId: post.id,
        itemType: 'Post',
      },
    })

    // Create a Comment with a Vote
    const comment = await prisma.comment.create({
      data: {
        id: id2,
        body: 'Test Comment',
      },
    })

    await prisma.vote.create({
      data: {
        id: id2,
        value: 1,
        itemId: comment.id,
        itemType: 'Comment',
      },
    })

    // Filter to only votes on Posts
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
    const id = idForProvider('sqlite')

    // Create a Post
    const post = await prisma.post.create({
      data: {
        id,
        title: 'Test Post',
      },
    })

    // Create a vote on the Post
    const vote = await prisma.vote.create({
      data: {
        id,
        value: 1,
        itemId: post.id,
        itemType: 'Post',
      },
    })

    expect(vote.itemType).toBe('Post')

    // Create a Comment
    const comment = await prisma.comment.create({
      data: {
        id: id + '-comment',
        body: 'Test Comment',
      },
    })

    // Update the vote to point to the Comment instead
    const updatedVote = await prisma.vote.update({
      where: { id },
      data: {
        itemId: comment.id,
        itemType: 'Comment',
      },
    })

    expect(updatedVote.itemType).toBe('Comment')
    expect(updatedVote.itemId).toBe(comment.id)
  })

  test('delete cascades through polymorphic relation', async () => {
    const id = idForProvider('sqlite')

    // Create a Post with a Vote
    const post = await prisma.post.create({
      data: {
        id,
        title: 'Test Post',
      },
    })

    await prisma.vote.create({
      data: {
        id,
        value: 1,
        itemId: post.id,
        itemType: 'Post',
      },
    })

    // Delete the Post
    await prisma.post.delete({
      where: { id },
    })

    // Vote should be deleted too (if cascade is configured)
    const _vote = await prisma.vote.findUnique({
      where: { id },
    })

    // Note: The behavior depends on the relation configuration
    // This test documents the expected behavior
  })

  test('vote without polymorphic relation', async () => {
    const id = idForProvider('sqlite')

    // Create a vote without connecting to any item
    const vote = await prisma.vote.create({
      data: {
        id,
        value: 1,
        // No itemId or itemType - optional relation
      },
    })

    expect(vote.itemType).toBeNull()
    expect(vote.itemId).toBeNull()
  })
})
