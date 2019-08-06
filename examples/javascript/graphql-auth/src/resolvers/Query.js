const { getUserId } = require('../utils')

const Query = {
  me: (parent, args, context) => {
    const userId = getUserId(context)
    return context.photon.users.findOne({ where: { id: userId } })
  },
  feed: (parent, args, context) => {
    return context.photon.posts.findMany({ where: { published: true } })
  },
  filterPosts: (parent, { searchString }, context) => {
    return context.photon.posts.findMany({
      where: {
        OR: [
          {
            title: {
              contains: searchString,
            },
          },
          {
            content: {
              contains: searchString,
            },
          },
        ],
      },
    })
  },
  post: (parent, { id }, context) => {
    return context.photon.posts.findOne({
      where: {
        id,
      },
    })
  },
}

module.exports = {
  Query,
}
