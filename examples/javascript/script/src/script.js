const Photon = require('../prisma/generated/photon')
const photon = new Photon()

// A `main` function so that we can use async/await
async function main() {
  // Retrieve all published posts
  const allPosts = await photon.posts.findMany({
    where: { published: true },
  })
  console.log(`Retrieved all published posts: `, allPosts)

  // Create a new post (written by an already existing user with email alice@prisma.io)
  const newPost = await photon.posts.create({
    data: {
      title: 'Join the Prisma Slack community',
      content: 'http://slack.prisma.io',
      published: false,
      author: {
        connect: {
          email: 'alice@prisma.io', // Should have been created during initial seeding
        },
      },
    },
  })
  console.log(`Created a new post: `, newPost)

  // Publish the new post
  const updatedPost = await photon.posts.update({
    where: {
      id: newPost.id,
    },
    data: {
      published: true,
    },
  })
  console.log(`Published the newly created post: `, updatedPost)

  // Retrieve all posts by user with email alice@prisma.io
  const postsByUser = await photon.users
    .findOne({
      email: 'alice@prisma.io',
    })
    .posts()
  console.log(`Retrieved all posts from a specific user: `, postsByUser)
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch(e => console.error(e))
  .finally(async () => {
    await photon.disconnect()
  })
