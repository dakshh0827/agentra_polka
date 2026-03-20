import prisma from '../lib/prisma.js'

class AnalyticsService {
  calculateScore(agent) {
    const voteFactor = Math.min(100, agent.upvotes || 0) * 0.4
    const usageFactor = Math.min(100, (agent.calls || 0) / 1000) * 0.3

    const revenueNum = Number(agent.revenue || '0') / 1e18
    const revenueFactor = Math.min(100, revenueNum / 100) * 0.2

    const successFactor = (agent.successRate || 0) * 0.1

    return parseFloat((voteFactor + usageFactor + revenueFactor + successFactor).toFixed(2))
  }

  async updateLeaderboardScores() {
    const agents = await prisma.agent.findMany({
      where: { status: { not: 'inactive' } },
    })

    const updates = agents.map(agent => {
      const score = this.calculateScore(agent)

      return prisma.agent.update({
        where: { id: agent.id },
        data: { score },
      })
    })

    await prisma.$transaction(updates)
    console.log(`[ANALYTICS] Updated scores for ${updates.length} agents`)
    return updates.length
  }

  async getLeaderboard(limit = 50) {
    return prisma.agent.findMany({
      where: { status: { not: 'inactive' } },
      orderBy: { score: 'desc' },
      take: limit,
      include: {
        metrics: true,
        _count: { select: { interactions: true } },
      },
    })
  }

  async getDashboard(walletAddress) {
    const wallet = walletAddress.toLowerCase()

    const [agents, transactions, recentInteractions, globalStats] = await prisma.$transaction([
      prisma.agent.findMany({
        where: { ownerWallet: wallet },
        include: { metrics: true },
      }),
      prisma.transaction.findMany({
        where: { ownerWallet: wallet, status: 'confirmed' },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.interaction.findMany({
        where: {
          agent: { ownerWallet: wallet },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { agent: { select: { name: true, agentId: true } } },
      }),
      prisma.globalStats.findUnique({ where: { id: 'global' } }),
    ])

    const totalRevenueWei = transactions.reduce((s, t) => {
      const creatorAmount = BigInt(t.creatorAmount || '0')
      return s + creatorAmount
    }, 0n)

    const totalRevenue = Number(totalRevenueWei) / 1e18
    const totalCalls = agents.reduce((s, a) => s + a.calls, 0)
    const avgSuccessRate = agents.length > 0
      ? agents.reduce((s, a) => s + a.successRate, 0) / agents.length
      : 0

    const revenueByDay = this._groupByDay(transactions, 7)

    // Agent performance chart data
    const agentPerf = agents.map(a => ({
      name: a.name.length > 10 ? a.name.slice(0, 10) + '…' : a.name,
      calls: a.calls,
      revenue: parseFloat((Number(a.revenue || '0') / 1e18).toFixed(4)),
    }))

    // Activity feed from recent interactions
    const activityFeed = recentInteractions.map(i => ({
      text: `${i.agent?.name || 'Agent'} executed${i.callerWallet ? ` by ${i.callerWallet.slice(0, 8)}...` : ''}`,
      time: new Date(i.createdAt).toLocaleTimeString(),
    }))

    return {
      metrics: {
        totalRevenue: parseFloat(totalRevenue.toFixed(6)),
        totalCalls,
        agentCount: agents.length,
        activeAgents: agents.filter(a => a.status === 'active').length,
        successRate: parseFloat(avgSuccessRate.toFixed(2)),
      },
      agents,
      revenueData: revenueByDay,
      agentPerf,
      activityFeed,
      globalStats,
    }
  }

  async getGlobalStats() {
    const [stats, agentCounts, topCategory] = await prisma.$transaction([
      prisma.globalStats.findUnique({ where: { id: 'global' } }),
      prisma.agent.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      prisma.agent.groupBy({
        by: ['category'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
    ])

    return {
      ...stats,
      agentsByStatus: agentCounts.reduce((acc, row) => {
        acc[row.status] = row._count.id
        return acc
      }, {}),
      topCategories: topCategory.map(row => ({
        category: row.category,
        count: row._count.id,
      })),
    }
  }

  async getAgentMetrics(agentId) {
    const agent = await prisma.agent.findFirst({
      where: { OR: [{ id: agentId }, { agentId }] },
      include: {
        metrics: true,
        _count: { select: { interactions: true } },
      },
    })

    if (!agent) throw Object.assign(new Error('Agent not found'), { status: 404 })

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const recentInteractions = await prisma.interaction.findMany({
      where: { agentId: agent.agentId, createdAt: { gte: yesterday } },
      orderBy: { createdAt: 'desc' },
      select: { latency: true, status: true, createdAt: true },
    })

    const latencies = recentInteractions
      .filter(i => i.latency)
      .map(i => i.latency)

    const p50 = this._percentile(latencies, 50)
    const p95 = this._percentile(latencies, 95)
    const p99 = this._percentile(latencies, 99)

    return {
      agent,
      votes: {
        upvotes: agent.upvotes,
        downvotes: 0,
        total: agent.upvotes,
      },
      latencyPercentiles: { p50, p95, p99 },
      last24h: {
        calls: recentInteractions.length,
        successRate: recentInteractions.length
          ? (
              (recentInteractions.filter(i => i.status === 'success').length /
                recentInteractions.length) *
              100
            ).toFixed(2)
          : 100,
      },
    }
  }

  _groupByDay(transactions, days) {
    const result = []

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)

      const next = new Date(date)
      next.setDate(next.getDate() + 1)

      const dayTxs = transactions.filter(t => {
        const d = new Date(t.createdAt)
        return d >= date && d < next
      })

      const revenueWei = dayTxs.reduce((s, t) => {
        return s + BigInt(t.creatorAmount || '0')
      }, 0n)

      result.push({
        day: date.toLocaleDateString('en', { weekday: 'short' }),
        date: date.toISOString().split('T')[0],
        eth: parseFloat((Number(revenueWei) / 1e18).toFixed(6)),
        transactions: dayTxs.length,
      })
    }

    return result
  }

  _percentile(arr, p) {
    if (!arr.length) return 0
    const sorted = [...arr].sort((a, b) => a - b)
    const idx = Math.ceil((p / 100) * sorted.length) - 1
    return sorted[Math.max(0, idx)]
  }
}

export default new AnalyticsService()