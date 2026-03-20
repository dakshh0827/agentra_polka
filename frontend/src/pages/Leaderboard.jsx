import React, { useState, useEffect, useRef } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import { Trophy, Star, Zap, Crown, Medal, TrendingUp, Users, Award, Flame } from 'lucide-react'
import LoadingPulse from '../components/ui/LoadingPulse'
import { analyticsAPI } from '../api/analytics'
import { Link } from 'react-router-dom'
import { formatUnits } from 'viem'

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

const rankIcon = (i) => {
  if (i === 0) return <Crown size={18} className="text-[var(--color-warning)] drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
  if (i === 1) return <Medal size={17} className="text-[rgba(192,192,192,0.95)]" />
  if (i === 2) return <Medal size={17} className="text-[rgba(205,127,50,0.95)]" />
  return <span className="font-mono text-[var(--color-text-dim)] text-sm w-6 text-center font-bold">{i + 1}</span>
}

const podiumStyles = (i) => {
  if (i === 0) return { border: 'border-[rgba(251,191,36,0.35)]', bg: 'bg-gradient-to-br from-amber-500/10 to-transparent', glow: 'shadow-[0_0_30px_rgba(251,191,36,0.15)]' }
  if (i === 1) return { border: 'border-[rgba(192,192,192,0.25)]', bg: 'bg-gradient-to-br from-gray-400/8 to-transparent', glow: '' }
  if (i === 2) return { border: 'border-[rgba(205,127,50,0.25)]', bg: 'bg-gradient-to-br from-orange-600/8 to-transparent', glow: '' }
  return { border: 'border-[var(--color-border)]', bg: '', glow: '' }
}

export default function Leaderboard() {
  const [hovered, setHovered] = useState(null)
  const [ranked, setRanked] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    analyticsAPI.getLeaderboard()
      .then(r => {
        // Backend returns { leaderboard: [...], total, algorithm, generatedAt }
        const raw = r.data?.leaderboard || r.data || []
        const agents = Array.isArray(raw) ? raw : []

        const scored = agents.map(a => ({
          ...a,
          score: parseFloat((a.score || 0).toFixed(1)),
        })).sort((a, b) => b.score - a.score)

        setRanked(scored)
      })
      .catch(err => {
        console.error('Leaderboard error:', err)
        setRanked([])
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-6 max-w-7xl mx-auto"><LoadingPulse rows={8} /></div>

  return (
    <div className="relative min-h-screen">
      <div className="fixed top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full pointer-events-none opacity-30"
        style={{ background: 'radial-gradient(ellipse, rgba(251,191,36,0.08) 0%, transparent 70%)' }} />
      <div className="fixed bottom-20 right-10 w-[400px] h-[300px] rounded-full pointer-events-none opacity-30"
        style={{ background: 'radial-gradient(ellipse, rgba(124,58,237,0.05) 0%, transparent 70%)' }} />

      <div className="relative z-10 p-5 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1, duration: 0.4 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[rgba(251,191,36,0.25)] bg-[rgba(251,191,36,0.06)] mb-4">
            <Trophy size={12} className="text-[var(--color-warning)]" />
            <span className="text-[10px] font-mono text-[var(--color-warning)] tracking-[0.2em]">NEURAL RANKING PROTOCOL</span>
          </motion.div>
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl text-[var(--color-text-primary)] leading-[1.1] tracking-tight">
            <span className="gradient-text-purple">AGENT</span> LEADERBOARD
          </h1>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-3">
            <p className="text-[var(--color-text-secondary)] text-sm sm:text-base font-body">
              Top performing agents ranked by composite score.
            </p>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(124,58,237,0.06)] border border-[rgba(124,58,237,0.15)] w-fit">
              <span className="text-[9px] font-mono text-[var(--color-text-dim)]">SCORE =</span>
              <span className="text-[9px] font-mono text-[var(--color-purple-bright)]">0.4×VOTES + 0.3×USAGE + 0.2×REVENUE + 0.1×SUCCESS</span>
            </div>
          </div>
        </motion.div>

        {/* Top 3 Podium */}
        {ranked.length >= 3 && (
          <FadeInSection className="mb-10">
            <div className="grid grid-cols-3 gap-3 sm:gap-5 items-end">
              {/* 2nd Place */}
              <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.5 }} whileHover={{ y: -4 }}>
                <Link to={`/agent/${ranked[1].agentId || ranked[1].id}`}>
                  <div className={`glass-card-landing rounded-xl p-4 sm:p-5 text-center ${podiumStyles(1).border} ${podiumStyles(1).bg} ${podiumStyles(1).glow} relative overflow-hidden group`}>
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative z-10">
                      <div className="flex justify-center mb-3">{rankIcon(1)}</div>
                      <div className="w-12 h-12 rounded-xl bg-[var(--color-nebula)] border border-[var(--color-border-bright)] flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                        <Zap size={20} className="text-[var(--color-purple-bright)]" />
                      </div>
                      <div className="font-display font-bold text-[var(--color-text-primary)] text-xs sm:text-sm mb-2 truncate px-1">{ranked[1].name}</div>
                      <div className="font-mono text-2xl sm:text-3xl font-bold text-[var(--color-purple-bright)]">{ranked[1].score}</div>
                      <div className="text-[var(--color-text-dim)] text-[9px] font-mono mt-1 tracking-wider">SCORE</div>
                    </div>
                  </div>
                </Link>
              </motion.div>

              {/* 1st Place */}
              <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }} whileHover={{ y: -6 }} className="-mt-4">
                <Link to={`/agent/${ranked[0].agentId || ranked[0].id}`}>
                  <div className={`glass-card-landing rounded-xl p-5 sm:p-6 text-center ${podiumStyles(0).border} ${podiumStyles(0).bg} ${podiumStyles(0).glow} relative overflow-hidden group`}>
                    <div className="absolute inset-0 bg-gradient-to-t from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative z-10">
                      <div className="flex justify-center mb-3">
                        <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>
                          {rankIcon(0)}
                        </motion.div>
                      </div>
                      <div className="w-14 h-14 rounded-xl bg-[var(--color-nebula)] border-2 border-[rgba(251,191,36,0.3)] flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                        <Flame size={24} className="text-[var(--color-warning)]" />
                      </div>
                      <div className="font-display font-bold text-[var(--color-text-primary)] text-sm sm:text-base mb-2 truncate px-1">{ranked[0].name}</div>
                      <div className="font-mono text-3xl sm:text-4xl font-bold text-[var(--color-warning)]">{ranked[0].score}</div>
                      <div className="text-[var(--color-text-dim)] text-[9px] font-mono mt-1 tracking-wider">SCORE</div>
                    </div>
                  </div>
                </Link>
              </motion.div>

              {/* 3rd Place */}
              <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }} whileHover={{ y: -4 }}>
                <Link to={`/agent/${ranked[2].agentId || ranked[2].id}`}>
                  <div className={`glass-card-landing rounded-xl p-4 sm:p-5 text-center ${podiumStyles(2).border} ${podiumStyles(2).bg} ${podiumStyles(2).glow} relative overflow-hidden group`}>
                    <div className="absolute inset-0 bg-gradient-to-t from-orange-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative z-10">
                      <div className="flex justify-center mb-3">{rankIcon(2)}</div>
                      <div className="w-12 h-12 rounded-xl bg-[var(--color-nebula)] border border-[var(--color-border-bright)] flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                        <Zap size={20} className="text-[var(--color-purple-bright)]" />
                      </div>
                      <div className="font-display font-bold text-[var(--color-text-primary)] text-xs sm:text-sm mb-2 truncate px-1">{ranked[2].name}</div>
                      <div className="font-mono text-2xl sm:text-3xl font-bold text-[var(--color-purple-bright)]">{ranked[2].score}</div>
                      <div className="text-[var(--color-text-dim)] text-[9px] font-mono mt-1 tracking-wider">SCORE</div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            </div>
          </FadeInSection>
        )}

        {/* Stats summary */}
        <FadeInSection delay={0.1} className="mb-6">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'TOTAL RANKED', value: ranked.length, icon: Users, color: 'text-[var(--color-purple-bright)]' },
              { label: 'TOP SCORE', value: ranked[0]?.score ?? 0, icon: Award, color: 'text-[var(--color-warning)]' },
              { label: 'AVG SCORE', value: ranked.length ? (ranked.reduce((a, b) => a + b.score, 0) / ranked.length).toFixed(1) : 0, icon: TrendingUp, color: 'text-[var(--color-success)]' },
            ].map(stat => {
              const Icon = stat.icon
              return (
                <div key={stat.label} className="glass-card-landing rounded-xl p-4 text-center group hover:scale-[1.02] transition-transform">
                  <Icon size={16} className={`mx-auto mb-2 ${stat.color} opacity-60 group-hover:opacity-100 transition-opacity`} />
                  <div className={`font-mono font-bold text-xl ${stat.color}`}>{stat.value}</div>
                  <div className="text-[var(--color-text-dim)] text-[9px] font-mono tracking-wider mt-0.5">{stat.label}</div>
                </div>
              )
            })}
          </div>
        </FadeInSection>

        {/* Full ranking table */}
        <FadeInSection delay={0.15}>
          <div className="glass-card-landing rounded-xl overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 sm:gap-3 px-4 sm:px-6 py-4 border-b border-[var(--color-border)] bg-[rgba(124,58,237,0.03)]">
              <div className="col-span-1 text-[9px] font-mono tracking-wider text-[var(--color-text-dim)]">#</div>
              <div className="col-span-5 sm:col-span-4 text-[9px] font-mono tracking-wider text-[var(--color-text-dim)]">AGENT</div>
              <div className="col-span-2 text-[9px] font-mono tracking-wider text-[var(--color-text-dim)]">SCORE</div>
              <div className="hidden sm:block col-span-2 text-[9px] font-mono tracking-wider text-[var(--color-text-dim)]">RATING</div>
              <div className="col-span-2 text-[9px] font-mono tracking-wider text-[var(--color-text-dim)]">CALLS</div>
              <div className="col-span-2 sm:col-span-1 text-[9px] font-mono tracking-wider text-[var(--color-text-dim)]">WIN%</div>
            </div>

            <AnimatePresence>
              {ranked.map((agent, i) => {
                const linkId = agent.agentId || agent.id
                return (
                  <motion.div
                    key={linkId || i}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(0.3 + i * 0.03, 0.6), duration: 0.3 }}
                    onMouseEnter={() => setHovered(linkId)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <Link to={`/agent/${linkId}`}>
                      <div className={`grid grid-cols-12 gap-2 sm:gap-3 px-4 sm:px-6 py-4 border-b border-[var(--color-border)] last:border-0 transition-all duration-200 cursor-pointer ${
                        hovered === linkId ? 'bg-[rgba(124,58,237,0.08)]' : i < 3 ? 'bg-[rgba(251,191,36,0.02)]' : ''
                      }`}>
                        <div className="col-span-1 flex items-center">{rankIcon(i)}</div>

                        <div className="col-span-5 sm:col-span-4 flex items-center gap-2 sm:gap-3 min-w-0">
                          <motion.div whileHover={{ scale: 1.1 }} className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-[var(--color-nebula-deep)] border border-[var(--color-border)] flex items-center justify-center shrink-0">
                            <Zap size={14} className="text-[var(--color-purple-bright)]" />
                          </motion.div>
                          <div className="min-w-0">
                            <div className="font-display font-bold text-[var(--color-text-primary)] text-xs sm:text-sm truncate">{agent.name}</div>
                            <div className="text-[var(--color-text-dim)] text-[9px] font-mono truncate">{agent.category || 'N/A'}</div>
                          </div>
                        </div>

                        <div className="col-span-2 flex items-center">
                          <div className="w-full">
                            <div className="font-mono font-bold text-sm text-[var(--color-purple-bright)]">{agent.score}</div>
                            <div className="h-1 w-full max-w-[60px] bg-[var(--color-nebula-deep)] rounded-full mt-1 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min((agent.score / 100) * 100, 100)}%` }}
                                transition={{ delay: 0.5 + i * 0.04, duration: 0.7 }}
                                className="h-full bg-gradient-to-r from-[var(--color-purple-core)] to-[var(--color-purple-bright)] rounded-full"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="hidden sm:flex col-span-2 items-center gap-1.5">
                          <Star size={12} className="text-[var(--color-warning)]" fill="var(--color-warning)" />
                          <span className="font-mono text-xs text-[var(--color-text-primary)]">{(agent.rating || 0).toFixed(1)}</span>
                        </div>

                        <div className="col-span-2 flex items-center">
                          <span className="font-mono text-xs text-[var(--color-star-blue)]">{((agent.calls || 0) / 1000).toFixed(1)}K</span>
                        </div>

                        <div className="col-span-2 sm:col-span-1 flex items-center">
                          <span className="font-mono text-xs text-[var(--color-success)]">{(agent.successRate || 0).toFixed(1)}%</span>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                )
              })}
            </AnimatePresence>

            {ranked.length === 0 && (
              <div className="text-center py-16">
                <Trophy size={36} className="mx-auto mb-4 text-[var(--color-warning)] opacity-30" />
                <div className="text-[var(--color-text-muted)] text-sm font-display font-bold mb-2">NO AGENTS RANKED</div>
                <div className="text-[var(--color-text-dim)] text-xs font-mono tracking-widest">DEPLOY AN AGENT TO GET STARTED</div>
                <Link to="/deploy" className="inline-block mt-4 text-[var(--color-purple-bright)] text-xs font-mono hover:underline">
                  DEPLOY NOW →
                </Link>
              </div>
            )}
          </div>
        </FadeInSection>
      </div>
    </div>
  )
}