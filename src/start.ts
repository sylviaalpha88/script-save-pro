import { createStartHandler, defaultStreamHandler } from '@tanstack/start/server'
import { getRouter } from './router'

// ⚡ Dynamic entry execution engine for TanStack Start
const router = getRouter()
const handler = createStartHandler({
  createRouter: getRouter,
  defaultStreamHandler,
})

export default handler
