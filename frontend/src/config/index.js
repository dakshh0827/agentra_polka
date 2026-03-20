import deployments from '../deployments.json'

// Re-export chain config
export { SUPPORTED_CHAINS, CHAIN_CONFIG } from './chains.config'

// Convenience: contracts for a given chainId
export function getContracts(chainId) {
  return deployments[chainId] || {}
}

// Default config object (used in TopBar etc.)
const config = {
  contracts: {
    // Fallback to local hardhat addresses; overridden at runtime via CHAIN_CONFIG
    agentra: deployments['31337']?.Agentra?.address || '',
    token: deployments['31337']?.AgentToken?.address || '',
  },
}

export default config