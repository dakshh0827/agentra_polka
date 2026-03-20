import { ethers } from 'ethers'
import config from '../config/config.js'

// ─────────────────────────────────────────────
// ABIs (Agentra + ERC20)
// ─────────────────────────────────────────────

const AGENTRA_ABI = [
  'function deployAgent(uint8 tier, uint256 monthlyPrice, string metadataURI)',
  'function purchaseAccess(uint256 agentId, bool isLifetime)',
  'function upvote(uint256 agentId)',
  'function agents(uint256) view returns (uint256 id, address creator, uint8 tier, uint256 monthlyPrice, string metadataURI, uint256 upvotes)',
  'function hasAccess(uint256 agentId, address user) view returns (bool)',

  'event AgentDeployed(uint256 indexed agentId, address indexed creator, uint8 tier)',
  'event AccessPurchased(uint256 indexed agentId, address indexed buyer, bool isLifetime)',
  'event AgentUpvoted(uint256 indexed agentId, address indexed voter)'
]

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)'
]

// ─────────────────────────────────────────────
// CONTRACT MANAGER
// ─────────────────────────────────────────────

class ContractManager {
  constructor() {
    this.provider = null
    this.signer = null
    this.agentra = null
    this.token = null
    this._initialized = false
    this._mockMode = false
  }

  async init() {
    if (this._initialized) return

    if (!config.blockchain.rpcUrl) {
      console.warn('[CONTRACTS] Mock mode enabled — no RPC URL configured')
      this._mockMode = true
      this._initialized = true
      return
    }

    try {
      this.provider = new ethers.JsonRpcProvider(config.blockchain.rpcUrl)

      if (config.blockchain.privateKey) {
        this.signer = new ethers.Wallet(config.blockchain.privateKey, this.provider)
        console.log('[CONTRACTS] Signer:', this.signer.address)
      }

      const runner = this.signer || this.provider

      const { agentra, token } = config.blockchain.contracts

      if (!agentra || !token) {
        console.warn('[CONTRACTS] Contract addresses not configured — mock mode enabled')
        this._mockMode = true
        this._initialized = true
        return
      }

      this.agentra = new ethers.Contract(agentra, AGENTRA_ABI, runner)
      this.token = new ethers.Contract(token, ERC20_ABI, runner)

      console.log('[CONTRACTS] Agentra:', agentra)
      console.log('[CONTRACTS] Token:', token)

      this._initialized = true
      console.log('[CONTRACTS] ✅ Initialized')
    } catch (err) {
      console.error('[CONTRACTS] Init failed:', err.message)
      this._mockMode = true
      this._initialized = true
    }
  }

  get isMock() {
    return this._mockMode
  }

  // ─────────────────────────────────────────────
  // NETWORK INFO (used by health check)
  // ─────────────────────────────────────────────

  async getNetworkInfo() {
    if (this._mockMode || !this.provider) {
      return { mock: true, rpcUrl: config.blockchain.rpcUrl || 'none' }
    }

    try {
      const network = await this.provider.getNetwork()
      return {
        chainId: Number(network.chainId),
        name: network.name,
        rpcUrl: config.blockchain.rpcUrl,
      }
    } catch (err) {
      return { error: err.message }
    }
  }

  // ─────────────────────────────────────────────
  // INTERNAL: APPROVE TOKENS
  // ─────────────────────────────────────────────

  async _ensureApproval(amountWei) {
    if (this._mockMode) return

    const owner = this.signer.address
    const spender = this.agentra.target

    const allowance = await this.token.allowance(owner, spender)

    if (allowance < amountWei) {
      console.log('[TOKEN] Approving tokens...')
      const tx = await this.token.approve(spender, amountWei)
      await tx.wait(1)
    }
  }

  // ─────────────────────────────────────────────
  // DEPLOY AGENT
  // ─────────────────────────────────────────────

  async deployAgent(tier, monthlyPriceWei, metadataURI) {
    if (this._mockMode) {
      return { success: true, txHash: `0xmock_deploy_${Date.now()}` }
    }

    try {
      const fee = await this.getListingFee(tier)

      await this._ensureApproval(fee)

      const tx = await this.agentra.deployAgent(tier, monthlyPriceWei, metadataURI)
      const receipt = await tx.wait(1)

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber
      }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  // ─────────────────────────────────────────────
  // PURCHASE ACCESS
  // ─────────────────────────────────────────────

  async purchaseAccess(agentId, isLifetime, monthlyPriceWei) {
    if (this._mockMode) {
      return { success: true, txHash: `0xmock_purchase_${Date.now()}` }
    }

    try {
      const totalCost = isLifetime
        ? BigInt(monthlyPriceWei) * 12n
        : BigInt(monthlyPriceWei)

      await this._ensureApproval(totalCost)

      const tx = await this.agentra.purchaseAccess(agentId, isLifetime)
      const receipt = await tx.wait(1)

      return {
        success: true,
        txHash: receipt.hash
      }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  // ─────────────────────────────────────────────
  // UPVOTE
  // ─────────────────────────────────────────────

  async upvote(agentId, upvoteCostWei) {
    if (this._mockMode) {
      return { success: true, txHash: `0xmock_upvote_${Date.now()}` }
    }

    try {
      await this._ensureApproval(BigInt(upvoteCostWei))

      const tx = await this.agentra.upvote(agentId)
      const receipt = await tx.wait(1)

      return {
        success: true,
        txHash: receipt.hash
      }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  // ─────────────────────────────────────────────
  // READ FUNCTIONS
  // ─────────────────────────────────────────────

  async getAgent(agentId) {
    if (this._mockMode) return null

    try {
      const a = await this.agentra.agents(agentId)

      return {
        id: Number(a.id),
        creator: a.creator,
        tier: Number(a.tier),
        monthlyPrice: a.monthlyPrice.toString(),
        metadataURI: a.metadataURI,
        upvotes: Number(a.upvotes)
      }
    } catch (err) {
      console.error('[CONTRACTS] getAgent error:', err.message)
      return null
    }
  }

  async hasAccess(agentId, user) {
    if (this._mockMode) return true

    try {
      return await this.agentra.hasAccess(agentId, user)
    } catch {
      return false
    }
  }

  async getTokenBalance(address) {
    if (this._mockMode) return '0'

    try {
      const bal = await this.token.balanceOf(address)
      return bal.toString()
    } catch {
      return '0'
    }
  }

  // ─────────────────────────────────────────────
  // LISTING FEES (STATIC FROM CONTRACT)
  // ─────────────────────────────────────────────

  async getListingFee(tier) {
    // mirror contract values: Standard=50, Professional=150, Enterprise=500 AGT
    if (tier === 0) return ethers.parseEther('50')
    if (tier === 1) return ethers.parseEther('150')
    if (tier === 2) return ethers.parseEther('500')
    return ethers.parseEther('50') // default to standard
  }

  // ─────────────────────────────────────────────
  // EVENTS
  // ─────────────────────────────────────────────

  onAgentDeployed(callback) {
    if (this._mockMode) return () => {}

    const handler = (agentId, creator, tier, event) => {
      callback({
        agentId: Number(agentId),
        creator,
        tier: Number(tier),
        txHash: event.log.transactionHash
      })
    }

    this.agentra.on('AgentDeployed', handler)
    return () => this.agentra.off('AgentDeployed', handler)
  }

  onAccessPurchased(callback) {
    if (this._mockMode) return () => {}

    const handler = (agentId, buyer, isLifetime, event) => {
      callback({
        agentId: Number(agentId),
        buyer,
        isLifetime,
        txHash: event.log.transactionHash
      })
    }

    this.agentra.on('AccessPurchased', handler)
    return () => this.agentra.off('AccessPurchased', handler)
  }

  onAgentUpvoted(callback) {
    if (this._mockMode) return () => {}

    const handler = (agentId, voter, event) => {
      callback({
        agentId: Number(agentId),
        voter,
        txHash: event.log.transactionHash
      })
    }

    this.agentra.on('AgentUpvoted', handler)
    return () => this.agentra.off('AgentUpvoted', handler)
  }

  // ─────────────────────────────────────────────
  // START LISTENERS (DB SYNC)
  // ─────────────────────────────────────────────

  startAllListeners(prisma) {
    if (this._mockMode) {
      console.log('[CONTRACTS] Mock mode — no listeners')
      return
    }

    // 🎯 Agent Deployed
    this.onAgentDeployed(async (event) => {
      console.log('[EVENT] AgentDeployed:', event.agentId)
      try {
        await prisma.agent.updateMany({
          where: { contractAgentId: event.agentId },
          data: { status: 'active' }
        })
      } catch (err) {
        console.error('[EVENT] AgentDeployed DB error:', err.message)
      }
    })

    // 💰 Access Purchased
    this.onAccessPurchased(async (event) => {
      console.log('[EVENT] AccessPurchased:', event.agentId)
      try {
        await prisma.agentAccess.upsert({
          where: {
            agentId_userWallet: {
              agentId: String(event.agentId),
              userWallet: event.buyer
            }
          },
          update: {
            isLifetime: event.isLifetime,
            expiresAt: event.isLifetime
              ? new Date('9999-12-31')
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          },
          create: {
            agentId: String(event.agentId),
            userWallet: event.buyer,
            isLifetime: event.isLifetime,
            expiresAt: event.isLifetime
              ? new Date('9999-12-31')
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          }
        })
      } catch (err) {
        console.error('[EVENT] AccessPurchased DB error:', err.message)
      }
    })

    // 👍 Upvote
    this.onAgentUpvoted(async (event) => {
      console.log('[EVENT] Upvote:', event.agentId)
      try {
        await prisma.agent.updateMany({
          where: { contractAgentId: event.agentId },
          data: { upvotes: { increment: 1 } }
        })
      } catch (err) {
        console.error('[EVENT] AgentUpvoted DB error:', err.message)
      }
    })

    console.log('[CONTRACTS] ✅ Event listeners running')
  }
}

export default new ContractManager()