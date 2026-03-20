import { Router } from 'express'
import {
  executeAgent,
  composeAgents,
  getInteractions,
} from '../controllers/executionController.js'
import { authMiddleware } from '../middlewares/auth.js'
import { executionLimiter } from '../middlewares/rateLimiter.js'

const router = Router()

// Execute agent (requires wallet + access)
router.post('/agents/:id/execute', authMiddleware, executionLimiter, executeAgent)

// Agent-to-agent composition
router.post('/agents/compose', authMiddleware, executionLimiter, composeAgents)

// Interaction history (public)
router.get('/agents/:id/interactions', getInteractions)

export default router