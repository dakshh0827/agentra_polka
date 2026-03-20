import React from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Zap, Star, TrendingUp, Activity, Tag, Shield } from 'lucide-react'
import { formatUnits } from 'viem'
import clsx from 'clsx'

const categoryColors = {
  Analysis: 'text-[var(--color-star-blue)] bg-[rgba(147,197,253,0.07)] border-[rgba(147,197,253,0.2)]',
  Development: 'text-[var(--color-purple-bright)] bg-[rgba(168,85,247,0.07)] border-[rgba(168,85,247,0.2)]',
  Security: 'text-[var(--color-danger)] bg-[rgba(248,113,113,0.07)] border-[rgba(248,113,113,0.2)]',
  Data: 'text-[var(--color-warning)] bg-[rgba(251,191,36,0.07)] border-[rgba(251,191,36,0.2)]',
  NLP: 'text-[var(--color-success)] bg-[rgba(52,211,153,0.07)] border-[rgba(52,211,153,0.2)]',
  Web3: 'text-[var(--color-accent-fuchsia)] bg-[rgba(217,70,239,0.07)] border-[rgba(217,70,239,0.2)]',
  Other: 'text-[var(--color-text-muted)] bg-[rgba(109,79,160,0.07)] border-[rgba(109,79,160,0.2)]',
}

const statusConfig = {
  active: { color: 'text-[var(--color-success)]', dot: 'bg-[var(--color-success)]' },
  busy: { color: 'text-[var(--color-warning)]', dot: 'bg-[var(--color-warning)]' },
  offline: { color: 'text-[var(--color-danger)]', dot: 'bg-[var(--color-danger)]' },
  draft: { color: 'text-[var(--color-text-dim)]', dot: 'bg-[var(--color-text-dim)]' },
}

/**
 * Format pricing from wei string to human-readable AGT.
 * Handles both wei strings (>1e15) and already-decimal values.
 */
function formatPricing(pricing) {
  if (!pricing) return '0'
  try {
    const num = BigInt(pricing)
    if (num > 1000000000000000n) {
      // It's wei
      return parseFloat(formatUnits(num, 18)).toFixed(4)
    }
    // Already a decimal or small number
    return parseFloat(pricing).toFixed(4)
  } catch {
    return parseFloat(pricing).toFixed(4)
  }
}

export default function AgentCard({ agent, index = 0 }) {
  const status = statusConfig[agent.status] || statusConfig.active
  const isOnChain = !!agent.contractAgentId
  const displayId = agent.agentId || agent.id || agent._id

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.04, duration: 0.4, type: 'spring' }}
      className="h-full"
    >
      <Link to={`/agent/${displayId}`} style={{ cursor: 'pointer', display: 'block', height: '100%' }}>
        <motion.div
          layoutId={`agent-bubble-${displayId}`}
          whileHover={{
            scale: 1.04,
            y: -8,
            boxShadow: '0 20px 40px -10px rgba(124,58,237,0.35), inset 0 0 20px rgba(124,58,237,0.15)',
            borderColor: 'rgba(168,85,247,0.5)',
          }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 350, damping: 20 }}
          className="glass-panel rounded-xl p-5 border border-[var(--color-border)] transition-colors duration-300 h-full flex flex-col relative overflow-hidden group"
        >
          {/* Hover background glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-[rgba(124,58,237,0.08)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

          <div className="relative z-10 flex flex-col h-full">
            {/* Header — always visible */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--color-nebula)] border border-[var(--color-border-bright)] flex items-center justify-center shrink-0">
                  <Zap size={17} className="text-[var(--color-purple-bright)]" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-[var(--color-text-primary)] text-sm tracking-wide leading-tight group-hover:text-[var(--color-purple-pale)] transition-colors duration-300">
                    {agent.name}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={clsx(
                      'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono border',
                      categoryColors[agent.category] || categoryColors.Other
                    )}>
                      {agent.category}
                    </span>
                    {isOnChain && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[rgba(124,58,237,0.1)] border border-[rgba(124,58,237,0.2)] text-[9px] font-mono text-[var(--color-purple-bright)]">
                        <Shield size={8} /> ON-CHAIN
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={clsx('w-1.5 h-1.5 rounded-full pulse-dot', status.dot)} />
                <span className={clsx('text-[10px] font-mono capitalize', status.color)}>{agent.status}</span>
              </div>
            </div>

            {/* Description — always visible */}
            <p className="text-[var(--color-text-muted)] text-xs leading-relaxed mb-3 line-clamp-2 group-hover:text-[var(--color-text-secondary)] transition-colors duration-300">
              {agent.description || 'No description provided.'}
            </p>

            {/* Tags — always visible */}
            {agent.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {agent.tags.slice(0, 3).map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--color-nebula-deep)] border border-[var(--color-border)] text-[var(--color-text-dim)] group-hover:border-[rgba(168,85,247,0.3)] transition-colors duration-300">
                    <Tag size={8} />
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Spacer: hidden metrics reveal on hover, pushing layout to flex properly */}
            <div
              className={clsx(
                'flex-1 flex flex-col justify-end',
                'overflow-hidden',
              )}
            >
              {/* Metrics — hidden by default, revealed on hover */}
              <div className="
                grid grid-cols-3 gap-2 mb-3 py-2.5
                border-t border-b border-[var(--color-border)]
                group-hover:border-[rgba(124,58,237,0.2)]
                transition-all duration-300
                opacity-0 max-h-0 pointer-events-none
                group-hover:opacity-100 group-hover:max-h-24 group-hover:pointer-events-auto
              ">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-[var(--color-warning)] mb-0.5">
                    <Star size={11} fill="currentColor" />
                    <span className="text-xs font-mono font-bold">{(agent.rating || 0).toFixed(1)}</span>
                  </div>
                  <div className="text-[9px] text-[var(--color-text-dim)] font-mono">RATING</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-[var(--color-star-blue)] mb-0.5">
                    <Activity size={11} />
                    <span className="text-xs font-mono font-bold">{((agent.calls || 0) / 1000).toFixed(1)}k</span>
                  </div>
                  <div className="text-[9px] text-[var(--color-text-dim)] font-mono">CALLS</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-[var(--color-success)] mb-0.5">
                    <TrendingUp size={11} />
                    <span className="text-xs font-mono font-bold">{(agent.successRate || 0).toFixed(1)}%</span>
                  </div>
                  <div className="text-[9px] text-[var(--color-text-dim)] font-mono">SUCCESS</div>
                </div>
              </div>

              {/* Price — hidden by default, revealed on hover */}
              <div className="
                flex items-center justify-between
                opacity-0 max-h-0 pointer-events-none
                group-hover:opacity-100 group-hover:max-h-12 group-hover:pointer-events-auto
                transition-all duration-300
              ">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[var(--color-purple-bright)] font-mono font-bold text-sm drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]">
                    {formatPricing(agent.pricing)} AGT
                  </span>
                  <span className="text-[var(--color-text-dim)] text-[10px] font-mono">/mo</span>
                </div>
                <span className="px-2.5 py-1 rounded bg-[var(--color-nebula)] border border-[var(--color-border-bright)] text-[var(--color-purple-bright)] text-[10px] font-mono tracking-widest group-hover:bg-[var(--color-purple-core)] group-hover:text-white group-hover:shadow-[0_0_15px_rgba(168,85,247,0.5)] transition-all duration-300">
                  VIEW →
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  )
}