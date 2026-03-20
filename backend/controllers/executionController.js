import orchestrator from '../orchestrator/orchestrator.js'
import prisma from '../lib/prisma.js'
import contractManager from '../lib/contractManager.js'
import config from '../config/config.js'
import { asyncHandler } from '../middlewares/errorHandler.js'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'

const executeSchema = z.object({
  task: z.string().min(1).max(10000),
})

const composeSchema = z.object({
  agents: z.array(z.object({
    agentId: z.string(),
    task: z.string().min(1),
  })).min(2).max(5),
  sequential: z.boolean().optional(),
})

/**
 * POST /agents/:id/execute
 */
const executeAgent = asyncHandler(async (req, res) => {
  const { task } = executeSchema.parse(req.body)
  const { id } = req.params
  const callerWallet = req.walletAddress

  // FIXED: Safely query the correct ID field based on format
  const isObjectId = /^[a-f\d]{24}$/i.test(id)
  const agent = await prisma.agent.findFirst({
    where: isObjectId ? { id } : { agentId: id },
  })

  if (!agent) return res.status(404).json({ error: 'Agent not found' })

  // Owner always has access
  if (agent.ownerWallet !== callerWallet) {
    // Check DB access
    const dbAccess = await prisma.agentAccess.findUnique({
      where: {
        agentId_userWallet: {
          agentId: agent.agentId,
          userWallet: callerWallet,
        },
      },
    })

    const hasDbAccess = dbAccess && (dbAccess.isLifetime || dbAccess.expiresAt > new Date())

    if (!hasDbAccess) {
      // For blockchain agents, check on-chain
      if (agent.contractAgentId) {
        const onChainAccess = await contractManager.hasAccess(agent.contractAgentId, callerWallet)
        if (!onChainAccess) {
          return res.status(403).json({ error: 'Access not purchased' })
        }
      } else {
        return res.status(403).json({ error: 'Access not purchased' })
      }
    }
  }

  const result = await orchestrator.executeAgent(agent.agentId, task, callerWallet)

  res.json(result)
})

/**
 * POST /agents/compose
 */
const composeAgents = asyncHandler(async (req, res) => {
  const { agents, sequential = false } = composeSchema.parse(req.body)
  const callerWallet = req.walletAddress
  const callChainId = uuidv4()

  let results

  if (sequential) {
    results = []
    let context = ''

    for (const [i, agentInput] of agents.entries()) {
      const agent = await prisma.agent.findFirst({
        where: { agentId: agentInput.agentId },
      })

      if (!agent) continue

      // Check access
      const hasAccess = await _checkAgentAccess(agent, callerWallet)
      if (!hasAccess) continue

      const task = context
        ? `${agentInput.task}\n\nContext:\n${context}`
        : agentInput.task

      const result = await orchestrator.executeAgent(agent.agentId, task, callerWallet, {
        callChainId,
        callDepth: i,
      })

      results.push(result)

      context =
        typeof result.response === 'string'
          ? result.response
          : JSON.stringify(result.response)
    }
  } else {
    results = await Promise.all(
      agents.map(async (agentInput, i) => {
        const agent = await prisma.agent.findFirst({
          where: { agentId: agentInput.agentId },
        })

        if (!agent) return null

        const hasAccess = await _checkAgentAccess(agent, callerWallet)
        if (!hasAccess) return null

        return orchestrator.executeAgent(agent.agentId, agentInput.task, callerWallet, {
          callChainId,
          callDepth: i,
        })
      })
    )
  }

  res.json({
    mode: sequential ? 'sequential' : 'parallel',
    agentCount: agents.length,
    callChainId,
    results,
  })
})

// Internal helper
async function _checkAgentAccess(agent, callerWallet) {
  if (agent.ownerWallet === callerWallet) return true

  const dbAccess = await prisma.agentAccess.findUnique({
    where: {
      agentId_userWallet: {
        agentId: agent.agentId,
        userWallet: callerWallet,
      },
    },
  })

  if (dbAccess && (dbAccess.isLifetime || dbAccess.expiresAt > new Date())) return true

  if (agent.contractAgentId) {
    return contractManager.hasAccess(agent.contractAgentId, callerWallet)
  }

  return false
}

/**
 * GET /agents/:id/interactions
 */
const getInteractions = asyncHandler(async (req, res) => {
  const { id } = req.params
  const limit = Math.min(parseInt(req.query.limit) || 50, 200)

  // FIXED: Passed `limit` inside an options object so Orchestrator can destructure it properly
  const history = await orchestrator.getInteractionHistory(id, { limit })
  res.json(history)
})

export {
  executeAgent,
  composeAgents,
  getInteractions,
}