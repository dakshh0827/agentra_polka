import api from './axios'

export const agentsAPI = {
  // ─────────────────────────────────────────────
  // READ
  // ─────────────────────────────────────────────
  getAll: (params) => api.get('/agents', { params }),

  getById: (id) => api.get(`/agents/${id}`),

  search: (query) => api.get('/agents/search', { params: { q: query } }),

  getMetrics: (id) => api.get(`/agents/${id}/metrics`),

  checkAccess: (agentId) => api.get(`/agents/${agentId}/access`),

  // ─────────────────────────────────────────────
  // DEPLOY AGENT FLOW
  // ─────────────────────────────────────────────

  /**
   * Create agent record.
   * For database-only: status goes active immediately.
   * For blockchain: status is DRAFT, awaiting confirmDeploy.
   */
  deploy: (data) =>
    api.post('/agents/deploy', {
      name: data.name,
      description: data.description,
      endpoint: data.endpoint,
      tier: data.tier,           // 'Standard' | 'Professional' | 'Enterprise'
      pricing: data.pricing,     // wei string
      tags: data.tags || [],
      category: data.category,
      mcpSchema: data.mcpSchema || undefined,
      deployMode: data.deployMode || 'database',
    }),

  /**
   * After on-chain tx confirmed, tell backend to activate the draft.
   * @param {string} id - DB record id
   * @param {string} txHash - deployment transaction hash
   * @param {number|string} contractAgentId - uint256 from AgentDeployed event
   */
  confirmDeploy: (id, txHash, contractAgentId) =>
    api.post(`/agents/${id}/confirm`, {
      txHash,
      contractAgentId: contractAgentId ? String(contractAgentId) : undefined,
    }),

  cancelDraft: (id) => api.delete(`/agents/${id}/draft`),

  // ─────────────────────────────────────────────
  // ACCESS PURCHASE
  // ─────────────────────────────────────────────

  /**
   * Record a completed purchase in the backend DB.
   * The actual ERC20 transfer happens client-side via wagmi writeContract.
   * @param {string} agentId - agent's agentId field
   * @param {boolean} isLifetime
   * @param {string} txHash - confirmed on-chain tx hash
   */
  purchaseAccess: (agentId, isLifetime, txHash) =>
    api.post(`/agents/${agentId}/purchase`, {
      isLifetime,
      txHash,
    }),

  // ─────────────────────────────────────────────
  // UPVOTE (PAID — 100% to creator)
  // ─────────────────────────────────────────────

  /**
   * Record upvote after on-chain tx.
   * @param {string} agentId
   * @param {string} txHash
   */
  upvote: (agentId, txHash) =>
    api.post(`/agents/${agentId}/upvote`, { txHash }),

  // ─────────────────────────────────────────────
  // EXECUTION (NO TOKEN PAYMENT)
  // ─────────────────────────────────────────────

  execute: (id, task) =>
    api.post(`/agents/${id}/execute`, { task }),

  // ─────────────────────────────────────────────
  // MANAGEMENT
  // ─────────────────────────────────────────────

  update: (id, data) => api.put(`/agents/${id}`, data),

  deactivate: (id) => api.delete(`/agents/${id}`),

  validateEndpoint: (endpoint) =>
    api.post('/agents/validate-endpoint', { endpoint }),
}