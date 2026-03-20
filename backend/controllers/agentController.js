import agentService from '../services/agentService.js'
import prisma from '../lib/prisma.js'
import contractManager from '../lib/contractManager.js'
import config from '../config/config.js'
import { asyncHandler } from '../middlewares/errorHandler.js'
import { z } from 'zod'

// ── Validation schemas ────────────────────────────────────

const deploySchema = z.object({
  name: z.string().min(2).max(64),
  description: z.string().min(10).max(1000).optional(),
  category: z.enum(['Analysis', 'Development', 'Security', 'Data', 'NLP', 'Web3', 'Other']),
  tags: z.array(z.string().max(32)).max(10).optional(),
  pricing: z.string(), // wei string
  tier: z.enum(['Standard', 'Professional', 'Enterprise']),
  endpoint: z.string().url(),
  mcpSchema: z.record(z.string(), z.unknown()).optional(),
  deployMode: z.enum(['database', 'blockchain']).optional(),
  status: z.string().optional(),
})

const updateSchema = z.object({
  name: z.string().min(2).max(64).optional(),
  description: z.string().min(10).max(1000).optional(),
  endpoint: z.string().url().optional(),
  pricing: z.string().optional(),
  tags: z.array(z.string()).optional(),
  category: z.enum(['Analysis', 'Development', 'Security', 'Data', 'NLP', 'Web3', 'Other']).optional(),
})

// ── Helpers ───────────────────────────────────────────────

const TIER_MAP = {
  Standard: 0,
  Professional: 1,
  Enterprise: 2,
}

// ── Controllers ───────────────────────────────────────────

const getAgents = asyncHandler(async (req, res) => {
  const { category, search, status, sortBy, page, limit, mine } = req.query

  const result = await agentService.getAgents({
    category: category === 'all' ? undefined : category,
    search,
    status: (!status || status === 'all') ? 'active' : status,
    sortBy: sortBy || 'score',
    page: parseInt(page) || 1,
    limit: Math.min(parseInt(limit) || 20, 100),
    ownerWallet: mine === 'true' ? req.walletAddress : undefined,
  })

  res.json(result)
})

const getAgentById = asyncHandler(async (req, res) => {
  const agent = await agentService.getById(req.params.id)
  res.json(agent)
})

// ── DEPLOY AGENT (ON-CHAIN + DB) ───────────────────────────

const deployAgent = asyncHandler(async (req, res) => {
  const data = deploySchema.parse(req.body)

  const metadataURI = `https://api.agentra.io/metadata/temp-${Date.now()}`
  const isBlockchain = data.deployMode === 'blockchain'

  // For database-only deploys, skip the contract call
  if (!isBlockchain) {
    const agent = await prisma.agent.create({
      data: {
        name: data.name,
        description: data.description,
        metadataUri: metadataURI,
        ownerWallet: req.walletAddress,
        endpoint: data.endpoint,
        tier: data.tier,
        pricing: data.pricing,
        category: data.category,
        tags: data.tags || [],
        mcpSchema: data.mcpSchema || null,
        status: 'active',
        txHash: null,
      },
    })

    await prisma.usageMetrics.create({
      data: { agentId: agent.id },
    })

    await prisma.globalStats.upsert({
      where: { id: 'global' },
      update: { totalAgents: { increment: 1 }, activeAgents: { increment: 1 } },
      create: { id: 'global', totalAgents: 1, activeAgents: 1, totalCalls: 0, totalRevenue: '0' },
    })

    return res.status(201).json(agent)
  }

  // 1. Call smart contract
  const tx = await contractManager.deployAgent(
    TIER_MAP[data.tier],
    BigInt(data.pricing),
    metadataURI
  )

  if (!tx.success) {
    return res.status(400).json({ error: tx.error })
  }

  // 2. Create DB record (pending confirmation)
  const agent = await prisma.agent.create({
    data: {
      name: data.name,
      description: data.description,
      metadataUri: metadataURI,
      ownerWallet: req.walletAddress,
      endpoint: data.endpoint,
      tier: data.tier,
      pricing: data.pricing,
      category: data.category,
      tags: data.tags || [],
      mcpSchema: data.mcpSchema || null,
      status: 'draft',
      txHash: tx.txHash,
    },
  })

  await prisma.usageMetrics.create({
    data: { agentId: agent.id },
  })

  await prisma.globalStats.upsert({
    where: { id: 'global' },
    update: { totalAgents: { increment: 1 } },
    create: { id: 'global', totalAgents: 1, activeAgents: 0, totalCalls: 0, totalRevenue: '0' },
  })

  // 3. Log transaction (listing fee — full amount to platform)
  const listingFeeWei = config.token.listingFeesWei[data.tier.toLowerCase()] || config.token.listingFeesWei.standard
  await prisma.transaction.create({
    data: {
      txHash: tx.txHash,
      type: 'deploy',
      status: 'pending',
      agentId: agent.agentId,
      callerWallet: req.walletAddress,
      ownerWallet: req.walletAddress,
      totalAmount: listingFeeWei,
      platformFee: listingFeeWei,
      creatorAmount: '0',
    },
  })

  res.status(201).json(agent)
})

// ── CONFIRM DEPLOY (SYNC CONTRACT ID) ──────────────────────

const confirmDeploy = asyncHandler(async (req, res) => {
  const { contractAgentId, txHash } = req.body
  const { id } = req.params

  const agent = await prisma.agent.update({
    where: {
      id,
      ownerWallet: req.walletAddress,
    },
    data: {
      status: 'active',
      contractAgentId: contractAgentId ? parseInt(contractAgentId) : undefined,
      txHash: txHash || undefined,
      isVerified: true,
    },
  })

  await prisma.transaction.updateMany({
    where: {
      agentId: agent.agentId,
      type: 'deploy',
    },
    data: {
      status: 'confirmed',
    },
  })

  await prisma.globalStats.upsert({
    where: { id: 'global' },
    update: { activeAgents: { increment: 1 } },
    create: { id: 'global', totalAgents: 1, activeAgents: 1, totalCalls: 0, totalRevenue: '0' },
  })

  res.json({ success: true, agent })
})

// ── CANCEL DRAFT ───────────────────────────────────────────

const cancelDraft = asyncHandler(async (req, res) => {
  const { id } = req.params

  await prisma.agent.delete({
    where: {
      id,
      status: 'draft',
      ownerWallet: req.walletAddress,
    },
  })

  res.json({ success: true })
})

// ── PURCHASE ACCESS ────────────────────────────────────────

const purchaseAccess = asyncHandler(async (req, res) => {
  const { agentId } = req.params
  const { isLifetime, txHash } = req.body

  const agent = await prisma.agent.findUnique({ where: { agentId } })
  if (!agent) return res.status(404).json({ error: 'Agent not found' })

  // If txHash provided (blockchain flow), just record it
  let finalTxHash = txHash
  if (!finalTxHash) {
    const tx = await contractManager.purchaseAccess(
      agent.contractAgentId,
      isLifetime,
      agent.pricing
    )
    if (!tx.success) {
      return res.status(400).json({ error: tx.error })
    }
    finalTxHash = tx.txHash
  }

  const totalCost = isLifetime
    ? (BigInt(agent.pricing) * 12n).toString()
    : agent.pricing

  // 80% to creator, 20% to platform
  const platformFee = (BigInt(totalCost) * 20n / 100n).toString()
  const creatorAmount = (BigInt(totalCost) - BigInt(platformFee)).toString()

  await prisma.transaction.create({
    data: {
      txHash: finalTxHash,
      type: 'purchase_access',
      status: 'confirmed',
      agentId: agent.agentId,
      callerWallet: req.walletAddress,
      ownerWallet: agent.ownerWallet,
      totalAmount: totalCost,
      platformFee,
      creatorAmount,
    },
  })

  // Record access in DB
  await prisma.agentAccess.upsert({
    where: {
      agentId_userWallet: {
        agentId: agent.agentId,
        userWallet: req.walletAddress,
      },
    },
    update: {
      isLifetime: isLifetime || false,
      expiresAt: isLifetime
        ? new Date('9999-12-31')
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    create: {
      agentId: agent.agentId,
      userWallet: req.walletAddress,
      isLifetime: isLifetime || false,
      expiresAt: isLifetime
        ? new Date('9999-12-31')
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })

  // Update agent revenue
  await prisma.agent.update({
    where: { id: agent.id },
    data: {
      revenue: (BigInt(agent.revenue || '0') + BigInt(creatorAmount)).toString(),
    },
  })

  res.json({ success: true, txHash: finalTxHash })
})

// ── UPVOTE ────────────────────────────────────────────────

const upvoteAgent = asyncHandler(async (req, res) => {
  const { agentId } = req.params
  const { txHash } = req.body

  const agent = await prisma.agent.findUnique({ where: { agentId } })
  if (!agent) return res.status(404).json({ error: 'Agent not found' })

  if (agent.ownerWallet === req.walletAddress) {
    return res.status(400).json({ error: 'Cannot upvote your own agent' })
  }

  let finalTxHash = txHash
  if (!finalTxHash) {
    const tx = await contractManager.upvote(
      agent.contractAgentId,
      config.token.upvoteCostWei
    )
    if (!tx.success) {
      return res.status(400).json({ error: tx.error })
    }
    finalTxHash = tx.txHash
  }

  await prisma.transaction.create({
    data: {
      txHash: finalTxHash,
      type: 'upvote',
      status: 'confirmed',
      agentId: agent.agentId,
      callerWallet: req.walletAddress,
      ownerWallet: agent.ownerWallet,
      totalAmount: config.token.upvoteCostWei,
      platformFee: '0',
      creatorAmount: config.token.upvoteCostWei, // 100% to creator
    },
  })

  await prisma.agent.update({
    where: { id: agent.id },
    data: {
      upvotes: { increment: 1 },
      revenue: (BigInt(agent.revenue || '0') + BigInt(config.token.upvoteCostWei)).toString(),
    },
  })

  res.json({ success: true, txHash: finalTxHash })
})

// ── CHECK ACCESS ──────────────────────────────────────────

const checkAccess = asyncHandler(async (req, res) => {
  const { agentId } = req.params
  const walletAddress = req.walletAddress

  const agent = await prisma.agent.findUnique({ where: { agentId } })
  if (!agent) return res.status(404).json({ error: 'Agent not found' })

  // Owner always has access
  if (agent.ownerWallet === walletAddress) {
    return res.json({ hasAccess: true, reason: 'owner' })
  }

  // Check DB access record
  const access = await prisma.agentAccess.findUnique({
    where: {
      agentId_userWallet: {
        agentId: agent.agentId,
        userWallet: walletAddress,
      },
    },
  })

  if (access && (access.isLifetime || access.expiresAt > new Date())) {
    return res.json({ hasAccess: true, reason: 'purchased', expiresAt: access.expiresAt })
  }

  // For blockchain agents, also check on-chain
  if (agent.contractAgentId) {
    const onChainAccess = await contractManager.hasAccess(agent.contractAgentId, walletAddress)
    if (onChainAccess) {
      return res.json({ hasAccess: true, reason: 'on-chain' })
    }
  }

  res.json({ hasAccess: false })
})

// ── UPDATE / DELETE ───────────────────────────────────────

const updateAgent = asyncHandler(async (req, res) => {
  const data = updateSchema.parse(req.body)
  const agent = await agentService.updateAgent(req.params.id, data, req.walletAddress)
  res.json(agent)
})

const deleteAgent = asyncHandler(async (req, res) => {
  await agentService.deactivateAgent(req.params.id, req.walletAddress)
  res.json({ message: 'Agent deactivated successfully' })
})

// ── OTHER ─────────────────────────────────────────────────

const validateEndpoint = asyncHandler(async (req, res) => {
  const { endpoint } = req.body
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' })
  const result = await agentService.validateEndpoint(endpoint)
  res.json(result)
})

const searchAgents = asyncHandler(async (req, res) => {
  const { q } = req.query
  if (!q) return res.status(400).json({ error: 'query param q required' })
  const agents = await agentService.searchAgents(q)
  res.json(agents)
})

export {
  getAgents,
  getAgentById,
  deployAgent,
  confirmDeploy,
  cancelDraft,
  purchaseAccess,
  upvoteAgent,
  checkAccess,
  updateAgent,
  deleteAgent,
  validateEndpoint,
  searchAgents,
}