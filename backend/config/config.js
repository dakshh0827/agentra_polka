import dotenv from 'dotenv'

dotenv.config()

const config = {
  port: parseInt(process.env.PORT) || 5001,
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-CHANGE-ME',
    expiresIn: '7d',
  },

  blockchain: {
    rpcUrl: process.env.BLOCKCHAIN_RPC_URL || '',
    privateKey: process.env.PRIVATE_KEY || '',
    contracts: {
      agentra: process.env.AGENTRA_CONTRACT_ADDRESS || '',
      token: process.env.AGENT_TOKEN_ADDRESS || '',
    },
  },

  token: {
    decimals: 18,
    upvoteCostWei: process.env.UPVOTE_COST_WEI || '1000000000000000000', // 1 AGT
    listingFeesWei: {
      // Keyed by lowercase tier name for easy lookup
      standard: process.env.LISTING_FEE_STANDARD || '50000000000000000000',       // 50 AGT
      professional: process.env.LISTING_FEE_PRO || '150000000000000000000',        // 150 AGT
      enterprise: process.env.LISTING_FEE_ENTERPRISE || '500000000000000000000',   // 500 AGT
    },
  },

  ipfs: {
    projectId: process.env.IPFS_PROJECT_ID || '',
    projectSecret: process.env.IPFS_PROJECT_SECRET || '',
    gateway: process.env.IPFS_GATEWAY || '',
  },

  platform: {
    maxCallDepth: parseInt(process.env.MAX_CALL_DEPTH) || 5,
    callTimeoutMs: parseInt(process.env.CALL_TIMEOUT_MS) || 30000,
    rateLimitWindow: 60 * 1000,
    rateLimitMax: 100,
    executionRateLimitMax: 20,
    deployRateLimitMax: 10,
    leaderboardCronSchedule: '*/5 * * * *',
    healthCheckCronSchedule: '*/2 * * * *',
  },
}

export default config