import React, { useState, useEffect, useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Search, Zap, Globe, RefreshCw, Sparkles, TrendingUp, Activity, Cpu } from 'lucide-react'
import AgentCard from '../components/ui/AgentCard'
import NeonButton from '../components/ui/NeonButton'
import LoadingPulse from '../components/ui/LoadingPulse'
import { useAgents } from '../hooks/useAgents'
import { useMarketplaceStore } from '../stores/marketplaceStore'
import { analyticsAPI } from '../api/analytics'

/* ── FadeInSection ── */
function FadeInSection({ children, className = '', delay = 0 }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-40px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

const CATEGORIES = ['all', 'Analysis', 'Development', 'Security', 'Data', 'NLP', 'Web3', 'Other']
const SORT_OPTIONS = [
  { value: 'score', label: 'SCORE' },
  { value: 'rating', label: 'RATING' },
  { value: 'calls', label: 'CALLS' },
  { value: 'newest', label: 'NEWEST' },
]

export default function Marketplace() {
  const { agents, isLoading } = useAgents()
  const { filters, search, setFilter, setSearch } = useMarketplaceStore()
  const [stats, setStats] = useState(null)
  const [hoveredStat, setHoveredStat] = useState(null)
  const [searchInput, setSearchInput] = useState(search)

  useEffect(() => {
    analyticsAPI.getGlobalStats()
      .then(r => setStats(r.data))
      .catch(() => {})
  }, [])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput, setSearch])

  const displayAgents = Array.isArray(agents) ? agents : []

  const filteredAgents = displayAgents.filter(a => {
    const matchSearch = !search ||
      a.name?.toLowerCase().includes(search.toLowerCase()) ||
      a.description?.toLowerCase().includes(search.toLowerCase()) ||
      (a.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()))
    const matchCat = !filters.category || filters.category === 'all' || a.category === filters.category
    return matchSearch && matchCat
  }).sort((a, b) => {
    if (filters.sortBy === 'rating') return (b.rating || 0) - (a.rating || 0)
    if (filters.sortBy === 'calls') return (b.calls || 0) - (a.calls || 0)
    if (filters.sortBy === 'newest') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    return (b.score || 0) - (a.score || 0) // default: score
  })

  const statCards = [
    { label: 'TOTAL AGENTS', value: stats?.totalAgents ?? displayAgents.length, color: 'purple', icon: Cpu, gradient: 'from-purple-500/20 to-transparent' },
    { label: 'ACTIVE NOW', value: stats?.activeAgents ?? '—', color: 'green', icon: Activity, gradient: 'from-emerald-500/20 to-transparent' },
    { label: 'TOTAL CALLS', value: stats?.totalCalls ? `${((stats.totalCalls) / 1000).toFixed(1)}k` : '—', color: 'blue', icon: TrendingUp, gradient: 'from-blue-500/20 to-transparent' },
    { label: 'PLATFORM VOLUME', value: stats?.totalRevenue ? `${parseFloat(stats.totalRevenue).toFixed(2)} AGT` : '—', color: 'yellow', icon: Sparkles, gradient: 'from-amber-500/20 to-transparent' },
  ]

  const colorMap = {
    purple: 'text-[var(--color-purple-bright)]',
    green: 'text-[var(--color-success)]',
    blue: 'text-[var(--color-star-blue)]',
    yellow: 'text-[var(--color-warning)]',
  }

  return (
    <div className="relative min-h-screen">
      <div className="fixed top-20 right-20 w-[500px] h-[400px] rounded-full pointer-events-none opacity-30"
        style={{ background: 'radial-gradient(ellipse, rgba(124,58,237,0.08) 0%, transparent 70%)' }} />
      <div className="fixed bottom-20 left-10 w-[400px] h-[300px] rounded-full pointer-events-none opacity-30"
        style={{ background: 'radial-gradient(ellipse, rgba(52,211,153,0.05) 0%, transparent 70%)' }} />

      <div className="relative z-10 p-5 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1, duration: 0.4 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[rgba(124,58,237,0.25)] bg-[rgba(124,58,237,0.06)] mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] pulse-dot" />
            <span className="text-[10px] font-mono text-[var(--color-purple-pale)] tracking-[0.2em]">
              NETWORK LIVE — {stats?.activeAgents ?? 0} AGENTS ONLINE
            </span>
          </motion.div>
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl text-[var(--color-text-primary)] leading-[1.1] tracking-tight">
            <span className="gradient-text-purple">AGENT</span> MARKETPLACE
          </h1>
          <p className="text-[var(--color-text-secondary)] text-sm sm:text-base font-body mt-3 max-w-xl">
            Discover, execute, and compose autonomous AI agents. Powered by AGT token.
          </p>
        </motion.div>

        {/* Stats bar */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15, duration: 0.5 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
          {statCards.map((stat, i) => {
            const Icon = stat.icon
            return (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.05 }}
                onMouseEnter={() => setHoveredStat(stat.label)} onMouseLeave={() => setHoveredStat(null)} className="group">
                <div className={`glass-card-landing rounded-xl p-4 sm:p-5 text-center relative overflow-hidden transition-all duration-300 ${hoveredStat === stat.label ? 'scale-[1.02]' : ''}`}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                  <div className="relative z-10">
                    <Icon size={18} className={`mx-auto mb-2 ${colorMap[stat.color]} opacity-60 group-hover:opacity-100 transition-opacity`} />
                    <div className={`font-mono font-bold text-2xl sm:text-3xl ${colorMap[stat.color]}`}>{stat.value}</div>
                    <div className="text-[var(--color-text-dim)] text-[9px] font-mono tracking-[0.2em] mt-1 uppercase">{stat.label}</div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </motion.div>

        {/* Search + Filters */}
        <FadeInSection className="mb-8">
          <div className="glass-card-landing rounded-xl p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="flex-1 relative group">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-dim)] group-focus-within:text-[var(--color-purple-bright)] transition-colors" />
                <input
                  type="text"
                  placeholder="Search agents, capabilities, tags..."
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  className="input-field w-full pl-11 pr-4 py-3 rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-purple-core)]/30 transition-all"
                />
              </div>
              <NeonButton variant="ghost" icon={RefreshCw} size="sm"
                onClick={() => { setSearchInput(''); setSearch(''); setFilter('category', 'all') }}
                className="shrink-0">
                <span className="hidden sm:inline">RESET</span>
              </NeonButton>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex gap-1.5 flex-wrap flex-1">
                {CATEGORIES.map(cat => (
                  <motion.button key={cat} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    onClick={() => setFilter('category', cat)}
                    className={`px-3 sm:px-4 py-2 rounded-lg font-mono text-[10px] tracking-[0.12em] border transition-all cursor-pointer ${
                      (filters?.category || 'all') === cat
                        ? 'bg-[rgba(124,58,237,0.15)] border-[var(--color-purple-core)] text-[var(--color-purple-bright)] shadow-[0_0_12px_rgba(124,58,237,0.2)]'
                        : 'bg-transparent border-[var(--color-border)] text-[var(--color-text-dim)] hover:border-[var(--color-border-bright)] hover:text-[var(--color-text-secondary)]'
                    }`}>
                    {cat.toUpperCase()}
                  </motion.button>
                ))}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[var(--color-text-dim)] text-[10px] font-mono">SORT:</span>
                <select
                  value={filters?.sortBy || 'score'}
                  onChange={e => setFilter('sortBy', e.target.value)}
                  className="input-field px-3 py-2 rounded-lg text-[10px] font-mono cursor-pointer bg-[var(--color-nebula-deep)] focus:ring-2 focus:ring-[var(--color-purple-core)]/30 transition-all"
                >
                  {SORT_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </FadeInSection>

        {/* Results count */}
        {!isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between mb-4">
            <div className="text-[var(--color-text-dim)] text-[11px] font-mono tracking-wider">
              SHOWING <span className="text-[var(--color-purple-bright)]">{filteredAgents.length}</span> AGENTS
            </div>
            <div className="hidden sm:flex items-center gap-2 text-[var(--color-text-dim)] text-[10px] font-mono">
              <Globe size={11} />
              <span>AGENTRA NETWORK</span>
            </div>
          </motion.div>
        )}

        {/* Agent grid */}
        {isLoading ? (
          <LoadingPulse rows={6} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
            {filteredAgents.map((agent, i) => (
              <FadeInSection key={agent.agentId || agent.id || i} delay={Math.min(i * 0.03, 0.3)}>
                <AgentCard agent={agent} index={i} />
              </FadeInSection>
            ))}
            {filteredAgents.length === 0 && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="col-span-full">
                <div className="glass-card-landing rounded-2xl p-12 sm:p-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[rgba(124,58,237,0.08)] border border-[rgba(124,58,237,0.15)] flex items-center justify-center mx-auto mb-5">
                    <Zap size={28} className="text-[var(--color-purple-bright)] opacity-50" />
                  </div>
                  <div className="text-[var(--color-text-muted)] text-sm font-display font-bold mb-2">NO AGENTS FOUND</div>
                  <div className="text-[var(--color-text-dim)] text-xs font-mono tracking-widest">TRY ADJUSTING YOUR SEARCH OR FILTERS</div>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}