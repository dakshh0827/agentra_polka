import { v4 as uuidv4 } from 'uuid'
import axios from 'axios'
import prisma from '../lib/prisma.js'
import agentService from './agentService.js'
import contractManager from '../blockchain/contracts.js'
import config from '../config/config.js'

class OrchestratorService {
  constructor() {
    this.activeChains = new Map()
    this.activeTimers = new Map()
    this.stats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      agentToAgentCalls: 0,
    }
  }

  async executeAgent(agentId, task, callerWallet, options = {}) {
    const {
      callDepth = 0,
      parentInteractionId = null,
      callChainId = uuidv4(),
    } = options

    this.stats.totalExecutions++

    if (callDepth > config.platform.maxCallDepth) {
      this.stats.failedExecutions++
      throw this._err(`Max call depth exceeded (limit: ${config.platform.maxCallDepth})`, 429)
    }

    this._checkAndRegisterChain(callChainId, agentId)

    const agent = await this._loadAgent(agentId)

    const hasAccess = await contractManager.hasAccess(
      agent.contractAgentId,
      callerWallet
    )

    if (!hasAccess) {
      throw this._err('Access not purchased for this agent', 403)
    }

    if (agent.status === 'active') {
      prisma.agent.update({
        where: { id: agent.id },
        data: { status: 'busy' },
      }).catch(() => {})
    }

    // FIXED: Use agent.agentId instead of agent.id
    const interactionRecord = await this._createInteractionRecord({
      agentId: agent.agentId, 
      callerWallet,
      task,
      callDepth,
      parentInteractionId,
    })

    const startTime = Date.now()
    let response, success, errorMessage

    try {
      response = await this._callWithTimeout(agent.endpoint, task, {
        callDepth,
        callChainId,
        interactionId: interactionRecord?.id,
        agentName: agent.name,
      })
      success = true
    } catch (err) {
      success = false
      errorMessage = err.message
      this.stats.failedExecutions++

      await this._finalizeInteraction(interactionRecord?.id, {
        status: 'failed',
        latency: Date.now() - startTime,
        errorMessage,
      })

      prisma.agent.update({
        where: { id: agent.id },
        data: { status: 'active' },
      }).catch(() => {})

      this._releaseChain(callChainId, agentId)
      throw this._err(`Agent execution failed: ${err.message}`, 502)
    }

    const latency = Date.now() - startTime

    await this._finalizeInteraction(interactionRecord?.id, {
      status: 'success',
      response: this._serializeResponse(response),
      latency,
    })

    // FIXED: Use agent.agentId instead of agent.id
    await agentService.recordExecution(agent.agentId, {
      success,
      latency,
    })

    prisma.agent.update({
      where: { id: agent.id },
      data: { status: 'active' },
    }).catch(() => {})

    this._releaseChain(callChainId, agentId)

    this.stats.successfulExecutions++
    if (callDepth > 0) this.stats.agentToAgentCalls++

    return {
      interactionId: interactionRecord?.id,
      agentId: agent.agentId,
      agentName: agent.name,
      task,
      response,
      latency,
      success: true,
      callDepth,
      callChainId,
      timestamp: new Date().toISOString(),
    }
  }

  async executeSequential(agentJobs, callerWallet, options = {}) {
    const callChainId = options.callChainId || uuidv4()
    const results = []
    let context = ''

    for (let i = 0; i < agentJobs.length; i++) {
      const { agentId, task } = agentJobs[i]

      const enrichedTask = context
        ? `${task}\n\n---\nContext from previous agent:\n${context}`
        : task

      const result = await this.executeAgent(agentId, enrichedTask, callerWallet, {
        callChainId,
        callDepth: i,
        parentInteractionId: results[i - 1]?.interactionId || null,
      })

      results.push(result)
      context = this._serializeResponse(result.response)
    }

    return {
      mode: 'sequential',
      callChainId,
      steps: agentJobs.length,
      results,
    }
  }

  async executeParallel(agentJobs, callerWallet, options = {}) {
    const callChainId = options.callChainId || uuidv4()

    const promises = agentJobs.map((job, i) =>
      this.executeAgent(job.agentId, job.task, callerWallet, {
        callChainId,
        callDepth: i,
      })
    )

    const settled = await Promise.allSettled(promises)

    const results = settled.map((r, i) => ({
      index: i,
      agentId: agentJobs[i].agentId,
      success: r.status === 'fulfilled',
      result: r.status === 'fulfilled' ? r.value : null,
      error: r.status === 'rejected' ? r.reason?.message : null,
    }))

    return {
      mode: 'parallel',
      callChainId,
      total: agentJobs.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    }
  }

  async getInteractionHistory(agentId, options = {}) {
    const {
      limit = 50,
      callerWallet = null,
      status = null,
      fromDate = null,
    } = options

    const where = { agentId }
    if (callerWallet) where.callerWallet = callerWallet.toLowerCase()
    if (status) where.status = status
    if (fromDate) where.createdAt = { gte: new Date(fromDate) }

    return prisma.interaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    })
  }

  async _loadAgent(agentId) {
    const agent = await agentService.getById(agentId)

    if (!agent) throw this._err('Agent not found', 404)
    if (agent.status === 'offline') throw this._err(`Agent "${agent.name}" is offline`, 503)
    if (agent.status === 'inactive') throw this._err(`Agent "${agent.name}" is inactive`, 503)

    return agent
  }

  async _createInteractionRecord({ agentId, callerWallet, task, callDepth, parentInteractionId }) {
    try {
      return await prisma.interaction.create({
        data: {
          agentId,
          callerWallet: callerWallet?.toLowerCase() || null,
          task: task?.slice(0, 10000) || null,
          callDepth,
          parentInteractionId,
          status: 'success',
        },
      })
    } catch {
      return null
    }
  }

  async _finalizeInteraction(interactionId, updates) {
    if (!interactionId) return
    try {
      await prisma.interaction.update({
        where: { id: interactionId },
        data: updates,
      })
    } catch {}
  }

  async _callWithTimeout(endpoint, task, meta = {}) {
    const timeout = config.platform.callTimeoutMs
    const controller = new AbortController()
    const timerId = setTimeout(() => controller.abort(), timeout)

    const interactionId = meta.interactionId
    if (interactionId) {
      this.activeTimers.set(interactionId, { controller, timerId })
    }

    const payload = {
      task,
      meta,
    }

    try {
      const res = await axios.post(`${endpoint}/execute`, payload, {
        timeout,
        signal: controller.signal,
      })

      clearTimeout(timerId)
      if (interactionId) this.activeTimers.delete(interactionId)

      return res.data
    } catch (err) {
      clearTimeout(timerId)
      if (interactionId) this.activeTimers.delete(interactionId)
      throw err
    }
  }

  _checkAndRegisterChain(callChainId, agentId) {
    if (!this.activeChains.has(callChainId)) {
      this.activeChains.set(callChainId, new Set())
    }
    const chain = this.activeChains.get(callChainId)
    if (chain.has(agentId)) {
      throw this._err(`Circular call detected`, 400)
    }
    chain.add(agentId)
  }

  _releaseChain(callChainId, agentId) {
    const chain = this.activeChains.get(callChainId)
    if (chain) {
      chain.delete(agentId)
      if (chain.size === 0) this.activeChains.delete(callChainId)
    }
  }

  _serializeResponse(response) {
    try {
      return typeof response === 'string' ? response : JSON.stringify(response)
    } catch {
      return String(response)
    }
  }

  _err(message, status = 500) {
    const err = new Error(message)
    err.status = status
    return err
  }
}

export default new OrchestratorService()