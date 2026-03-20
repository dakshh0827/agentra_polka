import prisma from '../lib/prisma.js'
import analyticsService from '../services/analyticsService.js'
import { asyncHandler } from '../middlewares/errorHandler.js'

const getLeaderboard = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100)
  const leaderboard = await analyticsService.getLeaderboard(limit)
  res.json(leaderboard)
})

const getDashboard = asyncHandler(async (req, res) => {
  const wallet = req.walletAddress
  const data = await analyticsService.getDashboard(wallet)
  res.json(data)
})

const getGlobalStats = asyncHandler(async (req, res) => {
  // Execute concurrent queries safely
  const [
    totalAgents,
    activeAgents,
    totalCalls,
    transactions,
    agents
  ] = await prisma.$transaction([
    prisma.agent.count(),
    prisma.agent.count({ where: { status: 'active' } }),
    prisma.interaction.count(),
    prisma.transaction.findMany({
      where: { status: 'confirmed' },
      select: { totalAmount: true } // totalAmount is a string
    }),
    prisma.agent.findMany({
      select: { successRate: true } // successRate is a float
    })
  ])

  // Calculate sum of string Wei values safely using BigInt
  const totalRevenueWei = transactions.reduce((acc, tx) => {
    return acc + BigInt(tx.totalAmount || "0");
  }, 0n);

  // Calculate average success rate manually
  const avgSuccessRate = agents.length > 0
    ? agents.reduce((acc, a) => acc + a.successRate, 0) / agents.length
    : 100;

  res.json({
    totalAgents,
    activeAgents,
    totalCalls,
    totalRevenue: totalRevenueWei.toString(),
    avgSuccessRate
  })
})

const getAgentMetrics = asyncHandler(async (req, res) => {
  const metrics = await analyticsService.getAgentMetrics(req.params.id)
  res.json(metrics)
})

export { getLeaderboard, getDashboard, getGlobalStats, getAgentMetrics }