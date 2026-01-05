import type { Task, User } from '.refract/types'

const exampleUser: User = {
  id: 1,
  email: 'studio@refract.dev',
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

console.log('[refract:vite] Types are live')
console.log('[refract:vite] Sample user', exampleUser)
console.log('[refract:vite] Sample task', exampleTask)

const app = document.querySelector<HTMLDivElement>('#app')
if (app) {
  app.innerHTML = `
    <h1>Refract + Vite Tooling Demo</h1>
    <p>Open the console to see generated types and live schema updates.</p>
  `
}
