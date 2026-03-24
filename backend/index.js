import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'

import config from './config/config.js'
import { errorHandler } from './middlewares/errorHandler.js'
import { apiLimiter } from './middlewares/rateLimiter.js'
import prisma from './lib/prisma.js'
import contractManager from './lib/contractManager.js'

// Routes
import agentRoutes from './routes/agentRoutes.js'
import authRoutes from './routes/authRoutes.js'
import executionRoutes from './routes/executionRoutes.js'
import analyticsRoutes from './routes/analyticsRoutes.js'
import reviewRoutes from './routes/reviewRoutes.js'

const app = express()

// ── Disable ETags globally ─────────────────────────────────────
// Without this, Express compares response bodies and sends 304 Not Modified,
// causing browsers to serve stale cached API responses. This is especially
// harmful for access/upvote checks where the answer depends on which wallet
// is currently connected — the browser has no way to know the wallet changed.
app.set('etag', false)

// ── Core middleware ────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
)

app.use(
  cors({
    origin: config.isDev
      ? [
          'http://localhost:3000',
          'http://localhost:5173',
          'http://127.0.0.1:5173',
          'http://localhost:5174',
        ]
      : process.env.ALLOWED_ORIGINS?.split(',') || [],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-wallet-address',
      'Cache-Control',
      'Pragma'
    ],
  })
)

app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true, limit: '2mb' }))
app.use(morgan(config.isDev ? 'dev' : 'combined'))
app.use(apiLimiter)

// ── No-cache middleware for all /api routes ────────────────────
// Forces the browser and any proxies to always make a real request
// instead of serving a cached response. Critical for wallet-dependent
// endpoints like /access and /upvote-status.
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.set('Pragma', 'no-cache')
  res.set('Expires', '0')
  next()
})

// ── Health check ───────────────────────────────────────────────
app.get('/health', async (req, res) => {
  const network = await contractManager.getNetworkInfo?.()
  res.json({
    status: 'ok',
    service: 'agentra-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    env: config.nodeEnv,
    blockchain: network || null,
  })
})

// ── API routes ─────────────────────────────────────────────────
app.use('/api/auth', authRoutes)
app.use('/api/agents', agentRoutes)
app.use('/api', executionRoutes)
app.use('/api', analyticsRoutes)
app.use('/api', reviewRoutes)

// ── 404 handler ────────────────────────────────────────────────
app.use('*', (req, res) => {
  res.status(404).json({
    error: `Route ${req.method} ${req.originalUrl} not found`,
  })
})

// ── Error handler ──────────────────────────────────────────────
app.use(errorHandler)

// ── Start server ───────────────────────────────────────────────
const start = async () => {
  try {
    await contractManager.init()

    if (!contractManager.isMock) {
      contractManager.startAllListeners(prisma)
    }

    app.listen(config.port, () => {
      console.log(`\n🚀 Agentra API running on port ${config.port}`)
      console.log(`   Environment  : ${config.nodeEnv}`)
      console.log(`   Database     : Prisma / MongoDB`)
      console.log(`   Blockchain   : ${contractManager.isMock ? 'Mock Mode' : 'Connected'}`)
      console.log(`   Health       : http://localhost:${config.port}/health\n`)
    })
  } catch (err) {
    console.error('❌ Startup error:', err)
    process.exit(1)
  }
}

start()

export default app