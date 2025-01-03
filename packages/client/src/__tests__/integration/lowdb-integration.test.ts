import { Low, JSONFile } from 'lowdb';
import { join } from 'path';

const file = join(__dirname, 'db.json');
const adapter = new JSONFile(file);
const db = new Low(adapter);

describe('lowdb integration', () => {
  beforeAll(async () => {
    await db.read();
    db.data ||= { posts: [] };
  });

  afterAll(async () => {
    db.data = { posts: [] };
    await db.write();
  });

  test('create post', async () => {
    const post = { id: 1, title: 'Hello World' };
    db.data.posts.push(post);
    await db.write();

    expect(db.data.posts).toContainEqual(post);
  });

  test('read post', async () => {
    const post = db.data.posts.find(p => p.id === 1);
    expect(post).toEqual({ id: 1, title: 'Hello World' });
  });

  test('update post', async () => {
    const post = db.data.posts.find(p => p.id === 1);
    post.title = 'Hello Universe';
    await db.write();

    const updatedPost = db.data.posts.find(p => p.id === 1);
    expect(updatedPost.title).toBe('Hello Universe');
  });

  test('delete post', async () => {
    db.data.posts = db.data.posts.filter(p => p.id !== 1);
    await db.write();

    const post = db.data.posts.find(p => p.id === 1);
    expect(post).toBeUndefined();
  });
});
