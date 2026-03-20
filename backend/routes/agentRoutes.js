import { Router } from 'express'
import {
  getAgents,
  getAgentById,
  deployAgent,
  confirmDeploy,
  cancelDraft,
  updateAgent,
  deleteAgent,
  validateEndpoint,
  searchAgents,
  purchaseAccess,
  upvoteAgent,
  checkAccess,
} from '../controllers/agentController.js'

import { authMiddleware, optionalAuth } from '../middlewares/auth.js'
import { deployLimiter } from '../middlewares/rateLimiter.js'

import { getAgentMetrics } from '../controllers/analyticsController.js'

const router = Router()

// ─────────────────────────────────────────────
// PUBLIC ROUTES
// ─────────────────────────────────────────────

router.get('/', optionalAuth, getAgents)
router.get('/search', searchAgents)
router.get('/:agentId/metrics', getAgentMetrics)

// ─────────────────────────────────────────────
// WEB3 ACTIONS (PROTECTED)
// ─────────────────────────────────────────────

// Deploy agent (creates draft first)
router.post('/deploy', authMiddleware, deployLimiter, deployAgent)

// Other protected routes before /:id to avoid conflicts
router.post('/validate-endpoint', authMiddleware, validateEndpoint)

// Routes with :id param
router.get('/:id', optionalAuth, getAgentById)

// Confirm on-chain deployment
router.post('/:id/confirm', authMiddleware, confirmDeploy)

// Cancel draft
router.delete('/:id/draft', authMiddleware, cancelDraft)

// Purchase access (monthly / lifetime)
router.post('/:agentId/purchase', authMiddleware, purchaseAccess)

// Upvote agent (paid)
router.post('/:agentId/upvote', authMiddleware, upvoteAgent)

// Check access
router.get('/:agentId/access', authMiddleware, checkAccess)

// Update / Delete
router.put('/:id', authMiddleware, updateAgent)
router.delete('/:id', authMiddleware, deleteAgent)

export default router