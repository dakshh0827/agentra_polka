import axios from 'axios'
import prisma from '../lib/prisma.js'
import agentService from '../services/agentService.js'
import contractManager from '../lib/contractManager.js'
import config from '../config/config.js'
import { v4 as uuidv4 } from 'uuid'

class Orchestrator {
  constructor() {
    this.activeChains = new Map()
  }

  async executeAgent(agentId, task, callerWallet, options = {}) {
    const {
      callDepth = 0,
      parentInteractionId = null,
      callChainId = uuidv4(),
    } = options

    if (callDepth > config.platform.maxCallDepth) {
      throw Object.assign(
        new Error(`Max call depth (${config.platform.maxCallDepth}) exceeded`),
        { status: 429 }
      )
    }

    if (!this.activeChains.has(callChainId)) {
      this.activeChains.set(callChainId, new Set())
    }
    const chain = this.activeChains.get(callChainId)

    if (chain.has(agentId)) {
      throw Object.assign(
        new Error(`Circular agent call detected: ${agentId}`),
        { status: 400 }
      )
    }
    chain.add(agentId)

    const agent = await agentService.getById(agentId)

    if (agent.status === 'offline' || agent.status === 'inactive') {
      chain.delete(agentId)
      throw Object.assign(
        new Error(`Agent "${agent.name}" is ${agent.status}`),
        { status: 503 }
      )
    }

    const interactionId = uuidv4()
    const startTime = Date.now()
    let interactionRecord

    try {
      interactionRecord = await prisma.interaction.create({
        data: {
          agentId: agent.agentId,
          callerWallet: callerWallet?.toLowerCase() || null,
          task,
          callDepth,
          parentInteractionId,
          status: 'success',
        },
      })
    } catch (err) {
      console.error('[ORCHESTRATOR] Interaction create failed:', err.message)
    }

    let response
    let success = false

    try {
      const result = await this._callAgentEndpoint(agent.endpoint, task, {
        callDepth,
        callChainId,
        interactionId: interactionRecord?.id,
      })

      response = result.data
      success = true
    } catch (err) {
      if (interactionRecord) {
        await prisma.interaction.update({
          where: { id: interactionRecord.id },
          data: {
            status: 'failed',
            errorMessage: err.message,
            latency: Date.now() - startTime,
          },
        })
      }

      chain.delete(agentId)
      if (chain.size === 0) this.activeChains.delete(callChainId)

      throw Object.assign(
        new Error(`Agent execution failed: ${err.message}`),
        { status: 502 }
      )
    }

    const latency = Date.now() - startTime

    if (interactionRecord) {
      await prisma.interaction.update({
        where: { id: interactionRecord.id },
        data: {
          response:
            typeof response === 'string'
              ? response
              : JSON.stringify(response),
          latency,
          status: 'success',
        },
      })
    }

    await agentService.recordExecution(agent.agentId, {
      success,
      latency,
    })

    chain.delete(agentId)
    if (chain.size === 0) this.activeChains.delete(callChainId)

    return {
      interactionId: interactionRecord?.id,
      agentId: agent.agentId,
      agentName: agent.name,
      task,
      response,
      latency,
      success: true,
      callDepth,
      timestamp: new Date().toISOString(),
    }
  }

  async agentToAgentCall(fromAgentId, toAgentId, task, parentOptions = {}) {
    return this.executeAgent(toAgentId, task, null, {
      ...parentOptions,
      callDepth: (parentOptions.callDepth || 0) + 1,
    })
  }

  async _callAgentEndpoint(endpoint, task, meta = {}) {
    const timeout = config.platform.callTimeoutMs

    const payload = {
      task,
      meta: {
        platform: 'agentra',
        version: '2.0',
        ...meta,
      },
    }

    try {
      return await axios.post(`${endpoint}/execute`, payload, {
        timeout,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (err) {
      if (err.response?.status === 404) {
        return await axios.post(endpoint, payload, {
          timeout,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      throw err
    }
  }

  async getInteractionHistory(agentId, limit = 50) {
    // Support both DB id and agentId string
    const agent = await prisma.agent.findFirst({
      where: { OR: [{ id: agentId }, { agentId }] },
    })

    if (!agent) return []

    return prisma.interaction.findMany({
      where: { agentId: agent.agentId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        callerWallet: true,
        task: true,
        latency: true,
        status: true,
        callDepth: true,
        createdAt: true,
      },
    })
  }
}

export default new Orchestrator()