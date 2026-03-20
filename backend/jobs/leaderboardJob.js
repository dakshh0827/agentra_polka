import cron from 'node-cron'
import analyticsService from '../services/analyticsService.js'
import config from '../config/config.js'
import prisma from '../lib/prisma.js'
import contractManager from '../lib/contractManager.js'

let isRunning = false

const runLeaderboardUpdate = async () => {
  if (isRunning) {
    console.log('[LEADERBOARD JOB] Already running, skipping...')
    return
  }

  isRunning = true

  try {
    await contractManager.init()

    const agents = await prisma.agent.findMany({
      where: { status: 'active' }
    })

    for (const agent of agents) {
      if (agent.contractAgentId) {
        const onChain = await contractManager.getAgent(agent.contractAgentId)

        if (onChain) {
          await prisma.agent.update({
            where: { id: agent.id },
            data: {
              upvotes: onChain.upvotes,
              pricing: onChain.monthlyPrice
            }
          })
        }
      }
    }

    const count = await analyticsService.updateLeaderboardScores()
    console.log(`[LEADERBOARD JOB] ✅ Updated ${count} agent scores`)
  } catch (err) {
    console.error('[LEADERBOARD JOB] ❌ Error:', err.message)
  } finally {
    isRunning = false
  }
}

const startLeaderboardJob = () => {
  const schedule = config.platform.leaderboardCronSchedule || '*/5 * * * *'
  console.log(`[LEADERBOARD JOB] Starting — schedule: ${schedule}`)

  cron.schedule(schedule, runLeaderboardUpdate)

  // Run once shortly after startup
  setTimeout(runLeaderboardUpdate, 3000)
}

export { startLeaderboardJob }