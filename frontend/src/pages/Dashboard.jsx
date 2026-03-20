import React, { useEffect, useState, useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'
import {
  BarChart3, TrendingUp, Zap, DollarSign, Activity,
  Wallet, Sparkles, Clock, ShieldCheck, Cpu
} from 'lucide-react'
import { useAccount, useReadContracts } from 'wagmi'
import { CHAIN_CONFIG } from '../config/chains.config'
import MetricBadge from '../components/ui/MetricBadge'
import LoadingPulse from '../components/ui/LoadingPulse'
import AgentCard from '../components/ui/AgentCard'
import { analyticsAPI } from '../api/analytics'
import { useAgents } from '../hooks/useAgents'
import { Link } from 'react-router-dom'

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

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-panel border border-[var(--color-border-bright)] rounded-lg px-4 py-3 text-xs font-mono shadow-xl">
      <div className="text-[var(--color-text-secondary)] font-bold mb-2">{label}</div>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2 mt-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-[var(--color-text-muted)]">{p.name}:</span>
          <span style={{ color: p.color }} className="font-bold">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { address: walletAddress, isConnected, chain } = useAccount()

  const [loading, setLoading] = useState(true)
  const [dashData, setDashData] = useState(null)
  const [hoveredMetric, setHoveredMetric] = useState(null)

  const { agents } = useAgents()

  useEffect(() => {
    if (!walletAddress) { setLoading(false); return }
    analyticsAPI.getDashboard(walletAddress)
      .then(r => setDashData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [walletAddress])

  // Agents owned by this user (from DB)
  const myAgents = (agents || []).filter(
    a => a.ownerWallet?.toLowerCase() === walletAddress?.toLowerCase()
  )

  // On-chain: batch check access for blockchain agents not owned by user
  const currentNetwork = chain?.id ? CHAIN_CONFIG[chain.id] : null
  const contracts = currentNetwork?.contracts

  const otherBlockchainAgents = (agents || []).filter(
    a => a.contractAgentId && a.ownerWallet?.toLowerCase() !== walletAddress?.toLowerCase()
  )

  const accessContracts = otherBlockchainAgents.map(agent => ({
    address: contracts?.Agentra?.address,
    abi: contracts?.Agentra?.abi,
    functionName: 'hasAccess',
    args: [BigInt(agent.contractAgentId || 0), walletAddress || '0x0000000000000000000000000000000000000000'],
  }))

  const { data: accessResults } = useReadContracts({
    contracts: accessContracts,
    query: { enabled: !!contracts && !!walletAddress && otherBlockchainAgents.length > 0 },
  })

  const purchasedAgents = otherBlockchainAgents.filter((_, i) => accessResults?.[i]?.result === true)

  if (!isConnected || !walletAddress) return (
    <div className="relative min-h-[80vh] flex items-center justify-center p-6">
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(124,58,237,0.06) 0%, transparent 70%)' }} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="glass-card-landing rounded-2xl p-10 sm:p-14 text-center max-w-md relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[150px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, rgba(124,58,237,0.12) 0%, transparent 70%)' }} />
        <div className="relative z-10">
          <div className="w-20 h-20 rounded-2xl bg-[rgba(124,58,237,0.1)] border border-[rgba(124,58,237,0.25)] flex items-center justify-center mx-auto mb-6">
            <Wallet size={36} className="text-[var(--color-purple-bright)] opacity-70" />
          </div>
          <h2 className="text-2xl font-display font-bold text-[var(--color-text-primary)] mb-3">Connect Wallet</h2>
          <p className="text-[var(--color-text-muted)] text-sm mb-6 leading-relaxed">
            Connect your wallet via the top bar to view your personal analytics, revenue, and agent performance.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {['Revenue Tracking', 'Agent Metrics', 'Activity Feed'].map(tag => (
              <span key={tag} className="px-3 py-1.5 rounded-lg border border-[rgba(124,58,237,0.15)] bg-[rgba(124,58,237,0.04)] text-[10px] font-mono text-[var(--color-purple-pale)] tracking-[0.1em]">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  )

  if (loading) return <div className="p-6 max-w-7xl mx-auto"><LoadingPulse rows={6} /></div>

  // dashData shape: { metrics, agents, revenueData, agentPerf, activityFeed, globalStats }
  const metrics = dashData?.metrics || {}
  const revenueData = dashData?.revenueData || []
  const agentPerf = dashData?.agentPerf || []
  const activityFeed = dashData?.activityFeed || []

  const metricCards = [
    { label: 'TOTAL REVENUE', value: `${parseFloat(metrics.totalRevenue || 0).toFixed(4)} AGT`, color: 'green', icon: DollarSign, sublabel: 'All time earnings', gradient: 'from-emerald-500/15 to-transparent' },
    { label: 'TOTAL CALLS', value: (metrics.totalCalls || 0).toLocaleString(), color: 'blue', icon: Activity, sublabel: 'Total executions', gradient: 'from-blue-500/15 to-transparent' },
    { label: 'MY AGENTS', value: myAgents.length, color: 'purple', icon: Zap, sublabel: 'Deployed on network', gradient: 'from-purple-500/15 to-transparent' },
    { label: 'SUCCESS RATE', value: `${(metrics.successRate || 0).toFixed(1)}%`, color: 'yellow', icon: TrendingUp, sublabel: 'Avg across agents', gradient: 'from-amber-500/15 to-transparent' },
  ]

  return (
    <div className="relative min-h-screen">
      <div className="fixed top-10 right-20 w-[450px] h-[350px] rounded-full pointer-events-none opacity-40"
        style={{ background: 'radial-gradient(ellipse, rgba(52,211,153,0.06) 0%, transparent 70%)' }} />
      <div className="fixed bottom-20 left-10 w-[400px] h-[300px] rounded-full pointer-events-none opacity-40"
        style={{ background: 'radial-gradient(ellipse, rgba(124,58,237,0.05) 0%, transparent 70%)' }} />

      <div className="relative z-10 p-5 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1, duration: 0.4 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[rgba(52,211,153,0.25)] bg-[rgba(52,211,153,0.06)] mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] pulse-dot" />
            <span className="text-[10px] font-mono text-[var(--color-success)] tracking-[0.2em]">ANALYTICS DASHBOARD — LIVE</span>
          </motion.div>
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl text-[var(--color-text-primary)] leading-[1.1] tracking-tight">
            <span className="gradient-text-purple">REVENUE</span> CONTROL
          </h1>
          <p className="text-[var(--color-text-secondary)] text-sm sm:text-base font-body mt-3 max-w-xl">
            Track your agent performance, monitor revenue streams, and analyze execution metrics in real-time.
          </p>
        </motion.div>

        {/* Metric cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
          {metricCards.map((m, i) => (
            <motion.div key={m.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}
              onMouseEnter={() => setHoveredMetric(m.label)} onMouseLeave={() => setHoveredMetric(null)} className="group">
              <div className={`glass-card-landing rounded-xl p-4 sm:p-5 relative overflow-hidden transition-all duration-300 ${hoveredMetric === m.label ? 'scale-[1.02]' : ''}`}>
                <div className={`absolute inset-0 bg-gradient-to-br ${m.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                <div className="relative z-10"><MetricBadge {...m} /></div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Charts grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
          {/* Revenue Chart */}
          <FadeInSection className="lg:col-span-2">
            <div className="glass-card-landing rounded-xl p-5 sm:p-6 h-full">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-display font-bold text-[var(--color-text-primary)] text-base sm:text-lg">Revenue Chart</h3>
                  <p className="text-[var(--color-text-dim)] text-[10px] font-mono tracking-wider mt-0.5">AGT EARNINGS OVER TIME</p>
                </div>
              </div>
              {revenueData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,0.1)" />
                    <XAxis dataKey="day" stroke="rgba(124,58,237,0.3)" tick={{ fontSize: 10, fontFamily: 'Space Mono', fill: 'var(--color-text-dim)' }} />
                    <YAxis stroke="rgba(124,58,237,0.3)" tick={{ fontSize: 10, fontFamily: 'Space Mono', fill: 'var(--color-text-dim)' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="eth" stroke="#a855f7" strokeWidth={2} fill="url(#revGrad)" name="AGT" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-[200px] text-center">
                  <Sparkles size={28} className="text-[var(--color-purple-bright)] opacity-30 mb-3" />
                  <div className="text-[var(--color-text-dim)] font-mono text-xs tracking-widest">NO REVENUE DATA YET</div>
                  <Link to="/deploy" className="mt-3 text-[var(--color-purple-bright)] text-[10px] font-mono hover:underline">DEPLOY AN AGENT →</Link>
                </div>
              )}
            </div>
          </FadeInSection>

          {/* Activity Feed */}
          <FadeInSection delay={0.1}>
            <div className="glass-card-landing rounded-xl p-5 sm:p-6 h-full">
              <div className="flex items-center gap-2 mb-5">
                <Clock size={14} className="text-[var(--color-purple-bright)]" />
                <h3 className="font-display font-bold text-[var(--color-text-primary)] text-base sm:text-lg">Activity Feed</h3>
              </div>
              <div className="space-y-3 overflow-y-auto max-h-52 pr-1">
                {activityFeed.length > 0 ? activityFeed.map((item, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.05 }}
                    whileHover={{ x: 4 }} className="flex items-start gap-3 pb-3 border-b border-[var(--color-border)] last:border-0 cursor-default group">
                    <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-[var(--color-purple-bright)] group-hover:scale-125 transition-transform" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors truncate">{item.text}</div>
                      <div className="text-[var(--color-text-dim)] text-[9px] font-mono mt-1">{item.time}</div>
                    </div>
                  </motion.div>
                )) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Activity size={24} className="text-[var(--color-text-dim)] opacity-30 mb-2" />
                    <div className="text-[var(--color-text-dim)] text-xs font-mono tracking-widest">NO RECENT ACTIVITY</div>
                  </div>
                )}
              </div>
            </div>
          </FadeInSection>
        </div>

        {/* Agent Grids */}
        <FadeInSection delay={0.2}>
          <div className="space-y-10 mb-10">
            {/* My Deployed Agents */}
            <div>
              <div className="flex items-center gap-2 mb-5">
                <Cpu size={20} className="text-[var(--color-purple-bright)]" />
                <h3 className="font-display font-bold text-[var(--color-text-primary)] text-xl sm:text-2xl">My Deployed Agents</h3>
              </div>
              {myAgents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                  {myAgents.map((agent, i) => (
                    <AgentCard key={agent.agentId || agent.id} agent={agent} index={i} />
                  ))}
                </div>
              ) : (
                <div className="glass-card-landing rounded-xl p-10 text-center border-dashed border border-[rgba(124,58,237,0.3)] bg-[rgba(124,58,237,0.02)]">
                  <div className="text-[var(--color-text-dim)] font-mono text-xs tracking-widest mb-3">NO AGENTS DEPLOYED YET</div>
                  <Link to="/deploy" className="text-[var(--color-purple-bright)] text-xs font-mono hover:underline">LAUNCH YOUR FIRST AGENT →</Link>
                </div>
              )}
            </div>

            {/* Purchased / Unlocked Agents */}
            <div>
              <div className="flex items-center gap-2 mb-5">
                <ShieldCheck size={20} className="text-[var(--color-success)]" />
                <h3 className="font-display font-bold text-[var(--color-text-primary)] text-xl sm:text-2xl">Unlocked Access</h3>
              </div>
              {purchasedAgents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                  {purchasedAgents.map((agent, i) => (
                    <AgentCard key={agent.agentId || agent.id} agent={agent} index={i} />
                  ))}
                </div>
              ) : (
                <div className="glass-card-landing rounded-xl p-10 text-center border-dashed border border-[rgba(52,211,153,0.3)] bg-[rgba(52,211,153,0.02)]">
                  <div className="text-[var(--color-text-dim)] font-mono text-xs tracking-widest mb-3">NO ON-CHAIN AGENTS PURCHASED</div>
                  <Link to="/marketplace" className="text-[var(--color-success)] text-xs font-mono hover:underline">EXPLORE MARKETPLACE →</Link>
                </div>
              )}
            </div>
          </div>
        </FadeInSection>

        {/* Performance chart */}
        <FadeInSection delay={0.25}>
          <div className="glass-card-landing rounded-xl p-5 sm:p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-display font-bold text-[var(--color-text-primary)] text-base sm:text-lg">Performance Metrics</h3>
                <p className="text-[var(--color-text-dim)] text-[10px] font-mono tracking-wider mt-0.5">CALLS VS REVENUE BY AGENT</p>
              </div>
              <div className="flex items-center gap-4 text-[10px] font-mono">
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded bg-[rgba(124,58,237,0.6)]" /><span className="text-[var(--color-text-dim)]">CALLS</span></div>
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded bg-[rgba(52,211,153,0.6)]" /><span className="text-[var(--color-text-dim)]">REVENUE</span></div>
              </div>
            </div>
            {agentPerf.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={agentPerf} barGap={6}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,0.1)" vertical={false} />
                  <XAxis dataKey="name" stroke="rgba(124,58,237,0.3)" tick={{ fontSize: 10, fontFamily: 'Space Mono', fill: 'var(--color-text-dim)' }} />
                  <YAxis stroke="rgba(124,58,237,0.3)" tick={{ fontSize: 10, fontFamily: 'Space Mono', fill: 'var(--color-text-dim)' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="calls" fill="rgba(124,58,237,0.5)" stroke="#7c3aed" strokeWidth={1} radius={[4, 4, 0, 0]} name="Calls" />
                  <Bar dataKey="revenue" fill="rgba(52,211,153,0.4)" stroke="#34d399" strokeWidth={1} radius={[4, 4, 0, 0]} name="Revenue (AGT)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[200px] text-center">
                <BarChart3 size={28} className="text-[var(--color-purple-bright)] opacity-30 mb-3" />
                <div className="text-[var(--color-text-dim)] font-mono text-xs tracking-widest">NO PERFORMANCE DATA</div>
                <p className="text-[var(--color-text-dim)] text-[10px] mt-2 max-w-xs">Deploy agents and receive executions to see performance metrics here.</p>
              </div>
            )}
          </div>
        </FadeInSection>
      </div>
    </div>
  )
}