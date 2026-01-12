import type { Task, User } from '.ork/types'

const exampleUser: User = {
  id: 1,
  email: 'studio@ork.dev',
  name: 'Type Explorer',
  tasks: [],
  createdAt: new Date(),
}

const exampleTask: Task = {
  id: 1,
  title: 'Schema synced by Vite',
  completed: false,
  createdAt: new Date(),
  userId: exampleUser.id,
  user: exampleUser,
}

console.log('[ork:vite] Types are live')
console.log('[ork:vite] Sample user', exampleUser)
console.log('[ork:vite] Sample task', exampleTask)

const app = document.querySelector<HTMLDivElement>('#app')
if (app) {
  app.innerHTML = `
    <h1>Ork + Vite Tooling Demo</h1>
    <p>Open the console to see generated types and live schema updates.</p>
  `
}
