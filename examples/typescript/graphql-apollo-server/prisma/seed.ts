import Photon from '@generated/photon'
const photon = new Photon()

async function main() {
  await photon.users.create({
    data: {
      email: 'alice@prisma.io',
      name: 'Alice',
      posts: {
        create: {
          title: 'Join us for GraphQL Conf 2019 in Berlin',
          content: 'https://www.graphqlconf.org/',
          published: true,
        },
      },
    },
  })
  await photon.users.create({
    data: {
      email: 'bob@prisma.io',
      name: 'Bob',
      posts: {
        create: [
          {
            title: 'Subscribe to GraphQL Weekly for community news',
            content: 'https://graphqlweekly.com/',
            published: true,
          },
          {
            title: 'Follow Prisma on Twitter',
            content: 'https://twitter.com/prisma',
            published: false,
          },
        ],
      },
    },
  })
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await photon.disconnect()
  })
