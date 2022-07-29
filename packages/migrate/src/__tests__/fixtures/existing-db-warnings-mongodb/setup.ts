import mongo from 'mongoose'

const postSchema = new mongo.Schema({
  title: String,
})

export async function setup(conn: mongo.Connection) {
  const Post = conn.model('Post', postSchema)
  const post1 = await Post.create({ title: 'post-1' })
  const post2 = await Post.create({ title: 'post-2' })

  process.stdout.write('post1: ' + post1 + '\n')
  process.stdout.write('post2: ' + post2 + '\n')
}

export async function inspect(conn: mongo.Connection) {
  const Post = conn.model('Post', postSchema)

  const posts = await Post.find({})
  return posts
}
