import React, { useState, useRef } from 'react'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import {
  Upload, ChevronRight, Check, Globe, Tag, DollarSign,
  Zap, Database, Link2, Sparkles, Rocket, AlertTriangle, Wallet
} from 'lucide-react'
import { useAccount, useWriteContract, usePublicClient } from 'wagmi'
import { parseUnits, decodeEventLog } from 'viem'
import { CHAIN_CONFIG } from '../config/chains.config'
import NeonButton from '../components/ui/NeonButton'
import { agentsAPI } from '../api/agents'

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

const STEPS = [
  { id: 1, label: 'MODE', icon: Database, description: 'Deploy target' },
  { id: 2, label: 'IDENTITY', icon: Zap, description: 'Name & category' },
  { id: 3, label: 'ENDPOINT', icon: Globe, description: 'MCP schema' },
  { id: 4, label: 'METADATA', icon: Tag, description: 'Tags & description' },
  { id: 5, label: 'PRICING', icon: DollarSign, description: 'Pay-per-call' },
  { id: 6, label: 'DEPLOY', icon: Upload, description: 'Publish agent' },
]

const CATEGORIES = ['Analysis', 'Development', 'Security', 'Data', 'NLP', 'Web3', 'Other']

// Tier config aligned with smart contract
// Standard=0 (50 AGT), Professional=1 (150 AGT), Enterprise=2 (500 AGT)
const TIER_OPTIONS = [
  {
    label: 'STANDARD',
    tier: 'Standard',
    tierIndex: 0,
    listingFee: '50',      // AGT
    desc: 'Basic tier — suitable for most agents',
    suggestedPrice: '0.01',
  },
  {
    label: 'PROFESSIONAL',
    tier: 'Professional',
    tierIndex: 1,
    listingFee: '150',
    desc: 'Professional tier — advanced features',
    suggestedPrice: '0.05',
  },
  {
    label: 'ENTERPRISE',
    tier: 'Enterprise',
    tierIndex: 2,
    listingFee: '500',
    desc: 'Enterprise tier — full capabilities',
    suggestedPrice: '0.15',
  },
]

const InputField = ({ label, field, type = 'text', placeholder, rows, form, update }) => (
  <div>
    <label className="text-[9px] font-mono text-[var(--color-text-dim)] tracking-[0.2em] uppercase block mb-2.5">{label}</label>
    {rows ? (
      <textarea
        value={form[field]}
        onChange={e => update(field, e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="input-field w-full px-4 py-3 rounded-xl text-sm resize-none focus:ring-2 focus:ring-[var(--color-purple-core)]/30 transition-all"
      />
    ) : (
      <input
        type={type}
        value={form[field]}
        onChange={e => update(field, e.target.value)}
        placeholder={placeholder}
        className="input-field w-full px-4 py-3 rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-purple-core)]/30 transition-all"
      />
    )}
  </div>
)

export default function DeployStudio() {
  const [step, setStep] = useState(1)
  const [deploying, setDeploying] = useState(false)
  const [deployed, setDeployed] = useState(false)
  const [deployError, setDeployError] = useState('')

  const { chain, address: walletAddress, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()

  const [form, setForm] = useState({
    deployMode: '',
    name: '',
    category: '',
    endpoint: '',
    mcpSchema: '',
    description: '',
    tags: '',
    tier: '',          // 'Standard' | 'Professional' | 'Enterprise'
    tierIndex: 0,
    pricing: '',       // human-readable AGT monthly price set by creator
    testPassed: false,
  })

  const update = (key, val) => setForm(f => ({ ...f, [key]: val }))
  const isBlockchain = form.deployMode === 'blockchain'
  const isDatabase = form.deployMode === 'database'

  const selectedTier = TIER_OPTIONS.find(t => t.tier === form.tier)

  const handleDeploy = async () => {
    if (!isConnected) return
    setDeploying(true)
    setDeployError('')
    let draftId = null

    try {
      let parsedSchema = null
      if (form.mcpSchema.trim()) {
        try { parsedSchema = JSON.parse(form.mcpSchema) }
        catch { throw new Error('Invalid MCP Schema JSON — please fix it before deploying.') }
      }

      // pricing in wei (creator sets monthly price)
      const pricingWei = parseUnits(form.pricing || '0', 18).toString()

      const payload = {
        name: form.name,
        category: form.category,
        endpoint: form.endpoint,
        mcpSchema: parsedSchema,
        description: form.description,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        tier: form.tier,
        pricing: pricingWei,
        deployMode: form.deployMode,
      }

      // ══════════════════════════════════════
      // FLOW 1: DATABASE ONLY (Off-chain)
      // ══════════════════════════════════════
      if (isDatabase) {
        await agentsAPI.deploy(payload)
        setDeployed(true)
        return
      }

      // ══════════════════════════════════════
      // FLOW 2: BLOCKCHAIN + DB
      // ══════════════════════════════════════
      const currentNetwork = chain?.id ? CHAIN_CONFIG[chain.id] : null
      if (!currentNetwork?.contracts) {
        throw new Error('Smart contracts not found for the current network. Please switch chains.')
      }

      const { Agentra, AgentToken } = currentNetwork.contracts

      // Step 1: Create DB draft → get id + metadataURI
      const draftRes = await agentsAPI.deploy({ ...payload, deployMode: 'blockchain' })
      draftId = draftRes.data.id
      const metadataURI = draftRes.data.metadataUri || `ipfs://pending-${draftId}`

      // Step 2: Listing fee in wei (paid fully to platform)
      const listingFeeWei = parseUnits(selectedTier?.listingFee || '50', 18)

      // Step 3: Approve listing fee
      const approveTx = await writeContractAsync({
        address: AgentToken.address,
        abi: AgentToken.abi,
        functionName: 'approve',
        args: [Agentra.address, listingFeeWei],
      })
      await publicClient.waitForTransactionReceipt({ hash: approveTx })

      // Step 4: Deploy agent on-chain
      const monthlyPriceWei = parseUnits(form.pricing || '0', 18)
      const deployTx = await writeContractAsync({
        address: Agentra.address,
        abi: Agentra.abi,
        functionName: 'deployAgent',
        args: [form.tierIndex, monthlyPriceWei, metadataURI],
      })
      const receipt = await publicClient.waitForTransactionReceipt({ hash: deployTx })

      // Step 5: Parse AgentDeployed event to get contractAgentId
      let contractAgentId = null
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: Agentra.abi,
            data: log.data,
            topics: log.topics,
          })
          if (decoded.eventName === 'AgentDeployed') {
            contractAgentId = decoded.args.agentId?.toString()
            break
          }
        } catch {
          // Skip non-matching logs
        }
      }

      // Step 6: Confirm in backend → marks draft as active
      await agentsAPI.confirmDeploy(draftId, receipt.transactionHash, contractAgentId)
      setDeployed(true)

    } catch (error) {
      console.error('Deploy error:', error)
      const msg = error.shortMessage || error.message || 'Unknown error'
      setDeployError(msg)

      // Rollback: delete orphaned draft
      if (draftId && isBlockchain) {
        await agentsAPI.cancelDraft(draftId).catch(e => console.error('Rollback failed:', e))
      }
    } finally {
      setDeploying(false)
    }
  }

  const canProceedFromStep1 = !!form.deployMode && isConnected
  const canDeploy = isConnected && form.name && form.category && form.tier && form.pricing

  return (
    <div className="relative min-h-screen">
      {/* Ambient glows */}
      <div className="fixed top-20 right-10 w-[500px] h-[400px] rounded-full pointer-events-none opacity-25"
        style={{ background: 'radial-gradient(ellipse, rgba(124,58,237,0.08) 0%, transparent 70%)' }} />
      <div className="fixed bottom-20 left-10 w-[400px] h-[300px] rounded-full pointer-events-none opacity-25"
        style={{ background: 'radial-gradient(ellipse, rgba(52,211,153,0.05) 0%, transparent 70%)' }} />

      <div className="relative z-10 p-5 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-9 h-9 rounded-xl bg-[rgba(124,58,237,0.1)] border border-[rgba(124,58,237,0.25)] flex items-center justify-center">
              <Rocket size={16} className="text-[var(--color-purple-bright)]" />
            </div>
            <span className="font-mono text-[10px] text-[var(--color-purple-pale)] tracking-[0.3em]">AGENT DEPLOYMENT PROTOCOL</span>
          </div>
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl text-[var(--color-text-primary)] leading-tight tracking-tight">
            <span className="gradient-text-purple">DEPLOY</span> STUDIO
          </h1>
          <p className="text-[var(--color-text-muted)] text-sm sm:text-base mt-2 max-w-lg">Launch your autonomous AI agent on the neural marketplace</p>
        </motion.div>

        {/* Step indicator */}
        <FadeInSection className="mb-8">
          <div className="glass-card-landing rounded-2xl p-4 sm:p-5">
            <div className="flex items-center gap-0 overflow-x-auto pb-1">
              {STEPS.map((s, i) => {
                const Icon = s.icon
                const isActive = step === s.id
                const isDone = step > s.id
                return (
                  <React.Fragment key={s.id}>
                    <motion.div
                      whileHover={isDone ? { y: -2, scale: 1.02 } : {}}
                      whileTap={isDone ? { scale: 0.98 } : {}}
                      onClick={() => isDone && setStep(s.id)}
                      className={`relative flex items-center gap-2.5 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-all shrink-0 ${isDone ? 'cursor-pointer' : ''} ${
                        isActive
                          ? 'bg-[rgba(124,58,237,0.12)] border border-[rgba(124,58,237,0.4)] text-[var(--color-purple-bright)] shadow-[0_0_20px_rgba(124,58,237,0.1)]'
                          : isDone
                          ? 'bg-[rgba(52,211,153,0.08)] border border-[rgba(52,211,153,0.25)] text-[var(--color-success)]'
                          : 'text-[var(--color-text-dim)] border border-transparent'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        isActive ? 'bg-[rgba(124,58,237,0.2)]' : isDone ? 'bg-[rgba(52,211,153,0.15)]' : 'bg-[var(--color-nebula-deep)]'
                      }`}>
                        {isDone ? <Check size={14} /> : <Icon size={14} />}
                      </div>
                      <div className="hidden sm:block">
                        <div className="text-[10px] font-mono font-bold tracking-[0.12em]">{s.label}</div>
                        <div className="text-[9px] opacity-50">{s.description}</div>
                      </div>
                      {isActive && (
                        <motion.div
                          layoutId="step-indicator"
                          className="absolute inset-0 rounded-xl border-2 border-[var(--color-purple-bright)] pointer-events-none"
                          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        />
                      )}
                    </motion.div>
                    {i < STEPS.length - 1 && (
                      <div className={`h-px w-4 sm:w-6 shrink-0 mx-0.5 transition-colors duration-300 ${step > s.id ? 'bg-[rgba(52,211,153,0.4)]' : 'bg-[var(--color-border)]'}`} />
                    )}
                  </React.Fragment>
                )
              })}
            </div>
            {/* Progress bar */}
            <div className="mt-4 h-1 bg-[var(--color-nebula-deep)] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-[var(--color-purple-core)] to-[var(--color-purple-bright)] rounded-full"
              />
            </div>
          </div>
        </FadeInSection>

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2 }}
          >
            <div className="glass-card-landing rounded-2xl p-6 sm:p-8">

              {/* ── STEP 1: DEPLOY MODE ── */}
              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="font-display font-bold text-xl sm:text-2xl text-[var(--color-text-primary)] mb-2 flex items-center gap-3">
                      <Sparkles size={20} className="text-[var(--color-purple-bright)]" />
                      Deployment Target
                    </h2>
                    <p className="text-[var(--color-text-muted)] text-sm leading-relaxed">
                      Choose whether your agent is registered on-chain (trustless payments) or database-only (free listing, no gas fees).
                    </p>
                  </div>

                  {!isConnected && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-3.5 p-4 sm:p-5 rounded-xl bg-[rgba(251,191,36,0.06)] border border-[rgba(251,191,36,0.25)]">
                      <div className="w-9 h-9 rounded-lg bg-[rgba(251,191,36,0.1)] flex items-center justify-center shrink-0">
                        <Wallet size={16} className="text-[var(--color-warning)]" />
                      </div>
                      <div>
                        <div className="text-[var(--color-warning)] text-[11px] font-mono font-bold tracking-widest mb-1">WALLET REQUIRED</div>
                        <div className="text-[var(--color-text-muted)] text-xs leading-relaxed">
                          Connect your wallet via the top bar before deploying. Your address identifies ownership on-chain and in the dashboard.
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                    {/* Database only */}
                    <motion.button whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.99 }}
                      onClick={() => update('deployMode', 'database')}
                      className={`relative p-5 sm:p-6 rounded-2xl border text-left transition-all cursor-pointer overflow-hidden ${
                        isDatabase ? 'bg-[rgba(52,211,153,0.08)] border-[rgba(52,211,153,0.4)] shadow-[0_0_30px_rgba(52,211,153,0.1)]' : 'border-[var(--color-border)] hover:border-[rgba(52,211,153,0.3)] bg-black/20'
                      }`}>
                      {isDatabase && <div className="absolute inset-0 bg-gradient-to-br from-[rgba(52,211,153,0.08)] to-transparent pointer-events-none" />}
                      <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center border transition-all ${isDatabase ? 'bg-[rgba(52,211,153,0.15)] border-[rgba(52,211,153,0.4)]' : 'bg-[var(--color-nebula-deep)] border-[var(--color-border)]'}`}>
                            <Database size={20} className={isDatabase ? 'text-[var(--color-success)]' : 'text-[var(--color-text-dim)]'} />
                          </div>
                          <div>
                            <div className={`font-mono font-bold text-xs tracking-widest ${isDatabase ? 'text-[var(--color-success)]' : 'text-[var(--color-text-secondary)]'}`}>DATABASE ONLY</div>
                            <div className="text-[9px] font-mono mt-0.5 text-[var(--color-text-dim)]">OFF-CHAIN · NO GAS</div>
                          </div>
                          {isDatabase && (
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="ml-auto w-6 h-6 rounded-full bg-[var(--color-success)] flex items-center justify-center">
                              <Check size={14} className="text-black" />
                            </motion.div>
                          )}
                        </div>
                        <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">
                          Agent stored in database only. Full marketplace access — execution, ratings, leaderboard — with no gas fees or token requirements.
                        </p>
                      </div>
                    </motion.button>

                    {/* Blockchain */}
                    <motion.button whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.99 }}
                      onClick={() => update('deployMode', 'blockchain')}
                      className={`relative p-5 sm:p-6 rounded-2xl border text-left transition-all cursor-pointer overflow-hidden ${
                        isBlockchain ? 'bg-[rgba(124,58,237,0.1)] border-[rgba(124,58,237,0.5)] shadow-[0_0_30px_rgba(124,58,237,0.12)]' : 'border-[var(--color-border)] hover:border-[rgba(124,58,237,0.3)] bg-black/20'
                      }`}>
                      {isBlockchain && <div className="absolute inset-0 bg-gradient-to-br from-[rgba(124,58,237,0.1)] to-transparent pointer-events-none" />}
                      <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center border transition-all ${isBlockchain ? 'bg-[rgba(124,58,237,0.15)] border-[rgba(124,58,237,0.4)]' : 'bg-[var(--color-nebula-deep)] border-[var(--color-border)]'}`}>
                            <Link2 size={20} className={isBlockchain ? 'text-[var(--color-purple-bright)]' : 'text-[var(--color-text-dim)]'} />
                          </div>
                          <div>
                            <div className={`font-mono font-bold text-xs tracking-widest ${isBlockchain ? 'text-[var(--color-purple-bright)]' : 'text-[var(--color-text-secondary)]'}`}>BLOCKCHAIN + DB</div>
                            <div className="text-[9px] font-mono mt-0.5 text-[var(--color-text-dim)]">ON-CHAIN · AGT FEE</div>
                          </div>
                          {isBlockchain && (
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="ml-auto w-6 h-6 rounded-full bg-[var(--color-purple-bright)] flex items-center justify-center">
                              <Check size={14} className="text-white" />
                            </motion.div>
                          )}
                        </div>
                        <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">
                          Agent registered on-chain. Trustless access control, on-chain payments (80% to you / 20% platform fee), immutable ownership.
                        </p>
                      </div>
                    </motion.button>
                  </div>

                  {form.deployMode && isConnected && (
                    <motion.div initial={{ opacity: 0, y: 6, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                      className={`flex items-center gap-3 text-[11px] font-mono px-4 py-3 rounded-xl border w-fit ${
                        isDatabase ? 'border-[rgba(52,211,153,0.25)] text-[var(--color-success)] bg-[rgba(52,211,153,0.05)]' : 'border-[rgba(124,58,237,0.25)] text-[var(--color-purple-bright)] bg-[rgba(124,58,237,0.05)]'
                      }`}>
                      <Check size={14} />
                      {isDatabase
                        ? `Database deploy · wallet ${walletAddress?.slice(0, 8)}... stored`
                        : `On-chain deploy · wallet ${walletAddress?.slice(0, 8)}... stored`}
                    </motion.div>
                  )}
                </div>
              )}

              {/* ── STEP 2: IDENTITY ── */}
              {step === 2 && (
                <div className="space-y-6">
                  <h2 className="font-display font-bold text-xl sm:text-2xl text-[var(--color-text-primary)] mb-6 flex items-center gap-3">
                    <Zap size={20} className="text-[var(--color-purple-bright)]" />
                    Agent Identity
                  </h2>
                  <InputField label="AGENT NAME" field="name" placeholder="e.g. DataSynth-X" form={form} update={update} />
                  <div>
                    <label className="text-[9px] font-mono text-[var(--color-text-dim)] tracking-[0.2em] uppercase block mb-3">CATEGORY</label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                      {CATEGORIES.map(cat => (
                        <motion.button key={cat} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                          onClick={() => update('category', cat)}
                          className={`py-2.5 px-4 rounded-xl text-[10px] font-mono border transition-all cursor-pointer ${
                            form.category === cat
                              ? 'bg-[rgba(124,58,237,0.12)] border-[var(--color-purple-core)] text-[var(--color-purple-bright)] shadow-[0_0_15px_rgba(124,58,237,0.15)]'
                              : 'border-[var(--color-border)] text-[var(--color-text-dim)] hover:border-[var(--color-border-bright)] hover:bg-[rgba(255,255,255,0.02)]'
                          }`}>
                          {cat.toUpperCase()}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── STEP 3: ENDPOINT ── */}
              {step === 3 && (
                <div className="space-y-6">
                  <h2 className="font-display font-bold text-xl sm:text-2xl text-[var(--color-text-primary)] mb-6 flex items-center gap-3">
                    <Globe size={20} className="text-[var(--color-purple-bright)]" />
                    MCP Endpoint
                  </h2>
                  <InputField label="ENDPOINT URL" field="endpoint" placeholder="https://your-agent.example.com" form={form} update={update} />
                  <InputField label="MCP SCHEMA (JSON — optional)"
                    field="mcpSchema" rows={8}
                    placeholder={'{\n  "name": "my-agent",\n  "version": "1.0.0",\n  "tools": []\n}'}
                    form={form} update={update}
                  />
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-black/30 border border-[var(--color-border)]">
                    <div className="flex items-center gap-3">
                      <Globe size={14} className="text-[var(--color-text-dim)]" />
                      <span className="text-xs font-mono text-[var(--color-text-muted)]">Optional: Validate endpoint reachability</span>
                    </div>
                    <NeonButton variant="ghost" size="sm" onClick={() => update('testPassed', true)}>TEST CONNECTION</NeonButton>
                  </div>
                </div>
              )}

              {/* ── STEP 4: METADATA ── */}
              {step === 4 && (
                <div className="space-y-6">
                  <h2 className="font-display font-bold text-xl sm:text-2xl text-[var(--color-text-primary)] mb-6 flex items-center gap-3">
                    <Tag size={20} className="text-[var(--color-purple-bright)]" />
                    Metadata
                  </h2>
                  <InputField label="DESCRIPTION" field="description" rows={4} placeholder="Describe what your agent does..." form={form} update={update} />
                  <InputField label="TAGS (comma separated)" field="tags" placeholder="e.g. analysis, data, ml" form={form} update={update} />
                </div>
              )}

              {/* ── STEP 5: PRICING / TIER ── */}
              {step === 5 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="font-display font-bold text-xl sm:text-2xl text-[var(--color-text-primary)] mb-2 flex items-center gap-3">
                      <DollarSign size={20} className="text-[var(--color-purple-bright)]" />
                      Tier & Pricing
                    </h2>
                    <p className="text-[var(--color-text-muted)] text-sm">
                      Choose your agent tier (one-time listing fee to platform) and set your monthly access price for users.
                      Users pay you 80% and the platform 20% per purchase.
                    </p>
                  </div>

                  {/* Tier selection */}
                  <div>
                    <label className="text-[9px] font-mono text-[var(--color-text-dim)] tracking-[0.2em] uppercase block mb-3">SELECT TIER</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {TIER_OPTIONS.map(tier => (
                        <motion.button key={tier.tier} whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            update('tier', tier.tier)
                            update('tierIndex', tier.tierIndex)
                            if (!form.pricing) update('pricing', tier.suggestedPrice)
                          }}
                          className={`p-5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                            form.tier === tier.tier
                              ? 'bg-[rgba(124,58,237,0.1)] border-[var(--color-purple-core)] shadow-[0_0_20px_rgba(124,58,237,0.12)]'
                              : 'border-[var(--color-border)] hover:border-[var(--color-border-bright)] bg-black/20'
                          }`}>
                          {form.tier === tier.tier && <div className="absolute inset-0 bg-gradient-to-br from-[rgba(124,58,237,0.08)] to-transparent pointer-events-none" />}
                          <div className="relative z-10">
                            <div className="flex justify-between items-start mb-2">
                              <div className={`text-[10px] font-mono font-bold tracking-widest ${form.tier === tier.tier ? 'text-[var(--color-purple-bright)]' : 'text-[var(--color-text-secondary)]'}`}>{tier.label}</div>
                              {isBlockchain && (
                                <div className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-purple-core)]/20 text-[var(--color-purple-bright)]">
                                  {tier.listingFee} AGT fee
                                </div>
                              )}
                            </div>
                            <div className="text-[10px] opacity-60 mt-1 text-[var(--color-text-muted)]">{tier.desc}</div>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Monthly pricing input */}
                  <div>
                    <label className="text-[9px] font-mono text-[var(--color-text-dim)] tracking-[0.2em] uppercase block mb-2.5">
                      YOUR MONTHLY PRICE (AGT) — 80% goes to you
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={form.pricing}
                        onChange={e => update('pricing', e.target.value)}
                        placeholder="e.g. 0.05"
                        className="input-field w-full px-4 py-3 rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-purple-core)]/30 transition-all"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-dim)] text-xs font-mono">AGT/mo</span>
                    </div>
                    {form.pricing && (
                      <p className="text-[10px] font-mono text-[var(--color-text-dim)] mt-2">
                        Per purchase: you receive <span className="text-[var(--color-success)]">{(parseFloat(form.pricing) * 0.8).toFixed(4)} AGT</span>, platform receives <span className="text-[var(--color-purple-bright)]">{(parseFloat(form.pricing) * 0.2).toFixed(4)} AGT</span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* ── STEP 6: REVIEW & DEPLOY ── */}
              {step === 6 && (
                <div className="space-y-6">
                  <h2 className="font-display font-bold text-xl sm:text-2xl text-[var(--color-text-primary)] mb-6 flex items-center gap-3">
                    <Upload size={20} className="text-[var(--color-purple-bright)]" />
                    Review & Deploy
                  </h2>

                  <div className="space-y-0 rounded-xl overflow-hidden border border-[var(--color-border)] bg-black/20">
                    {[
                      { label: 'DEPLOY MODE', value: isDatabase ? 'DATABASE ONLY' : 'BLOCKCHAIN + DB', highlight: isDatabase ? 'success' : 'purple' },
                      { label: 'OWNER WALLET', value: walletAddress ? `${walletAddress.slice(0, 18)}...` : '—', highlight: 'purple' },
                      { label: 'NAME', value: form.name || '—' },
                      { label: 'CATEGORY', value: form.category || '—' },
                      { label: 'TIER', value: form.tier || '—' },
                      { label: 'ENDPOINT', value: form.endpoint || '—' },
                      { label: 'MONTHLY PRICE', value: form.pricing ? `${form.pricing} AGT/mo` : '—' },
                      ...(isBlockchain && selectedTier ? [{ label: 'LISTING FEE (ONE-TIME)', value: `${selectedTier.listingFee} AGT → Platform`, highlight: 'warning' }] : []),
                    ].map((row, i) => (
                      <motion.div key={row.label} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                        className={`flex justify-between items-center px-5 py-3.5 ${i % 2 === 0 ? 'bg-[rgba(255,255,255,0.02)]' : ''}`}>
                        <span className="text-[var(--color-text-dim)] font-mono text-[10px] tracking-widest">{row.label}</span>
                        <span className={`font-mono text-sm truncate max-w-[55%] text-right font-medium ${
                          row.highlight === 'success' ? 'text-[var(--color-success)]'
                          : row.highlight === 'purple' ? 'text-[var(--color-purple-bright)]'
                          : row.highlight === 'warning' ? 'text-[var(--color-warning)]'
                          : 'text-[var(--color-text-primary)]'
                        }`}>{row.value}</span>
                      </motion.div>
                    ))}
                  </div>

                  {!isConnected && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-3.5 p-4 sm:p-5 rounded-xl bg-[rgba(248,113,113,0.06)] border border-[rgba(248,113,113,0.3)]">
                      <div className="w-9 h-9 rounded-lg bg-[rgba(248,113,113,0.1)] flex items-center justify-center shrink-0">
                        <AlertTriangle size={16} className="text-[var(--color-danger)]" />
                      </div>
                      <div>
                        <div className="text-[var(--color-danger)] text-[11px] font-mono font-bold tracking-widest mb-1">WALLET NOT CONNECTED</div>
                        <div className="text-[var(--color-text-muted)] text-xs">Connect your wallet to identify ownership and enable dashboard tracking.</div>
                      </div>
                    </motion.div>
                  )}

                  {deployError && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-3.5 p-4 rounded-xl bg-[rgba(248,113,113,0.06)] border border-[rgba(248,113,113,0.3)]">
                      <AlertTriangle size={16} className="text-[var(--color-danger)] shrink-0 mt-0.5" />
                      <div>
                        <div className="text-[var(--color-danger)] text-[11px] font-mono font-bold tracking-widest mb-1">DEPLOY FAILED</div>
                        <div className="text-[var(--color-text-muted)] text-xs font-mono">{deployError}</div>
                      </div>
                    </motion.div>
                  )}

                  {!deployed ? (
                    <div className="space-y-4 pt-2">
                      {isDatabase && (
                        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                          <NeonButton variant="success" size="lg" onClick={handleDeploy} loading={deploying} disabled={!canDeploy} className="w-full justify-center py-4 text-sm">
                            <Database size={17} />
                            {deploying ? 'SAVING TO DATABASE...' : 'SAVE TO DATABASE'}
                          </NeonButton>
                        </motion.div>
                      )}
                      {isBlockchain && (
                        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                          <NeonButton size="lg" onClick={handleDeploy} loading={deploying} disabled={!canDeploy} className="w-full justify-center py-4 text-sm">
                            <Link2 size={17} />
                            {deploying
                              ? 'AWAITING WALLET TX...'
                              : isConnected
                              ? `⚡ DEPLOY ON-CHAIN (2 TXs — ${selectedTier?.listingFee || '?'} AGT fee)`
                              : 'CONNECT WALLET TO DEPLOY'}
                          </NeonButton>
                        </motion.div>
                      )}
                    </div>
                  ) : (
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                      className={`p-8 rounded-2xl border text-center relative overflow-hidden ${
                        isDatabase ? 'bg-[rgba(52,211,153,0.08)] border-[rgba(52,211,153,0.35)]' : 'bg-[rgba(124,58,237,0.08)] border-[rgba(124,58,237,0.35)]'
                      }`}>
                      <div className="relative z-10">
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
                          className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center ${
                            isDatabase ? 'bg-[rgba(52,211,153,0.15)] border border-[rgba(52,211,153,0.3)]' : 'bg-[rgba(124,58,237,0.15)] border border-[rgba(124,58,237,0.3)]'
                          }`}>
                          <Check size={32} className={isDatabase ? 'text-[var(--color-success)]' : 'text-[var(--color-purple-bright)]'} />
                        </motion.div>
                        <div className={`font-display font-bold text-xl sm:text-2xl mb-2 ${isDatabase ? 'text-[var(--color-success)]' : 'text-[var(--color-purple-bright)]'}`}>
                          AGENT {isDatabase ? 'SAVED' : 'DEPLOYED'}!
                        </div>
                        <p className="text-[var(--color-text-muted)] text-sm mb-4">
                          {isDatabase ? 'Your agent is now live on the marketplace.' : 'Your agent is now registered on-chain and live on the marketplace.'}
                        </p>
                        <div className="text-[var(--color-text-dim)] text-[11px] font-mono px-3 py-2 rounded-lg bg-black/30 border border-[var(--color-border)] inline-block">
                          OWNER: {walletAddress?.slice(0, 18)}...
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        {!deployed && (
          <FadeInSection delay={0.1}>
            <div className="flex justify-between mt-6 gap-4">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <NeonButton variant="ghost" onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1 || deploying}>
                  ← BACK
                </NeonButton>
              </motion.div>
              {step < 6 && (
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <NeonButton
                    icon={ChevronRight}
                    onClick={() => setStep(s => Math.min(6, s + 1))}
                    disabled={(step === 1 && !canProceedFromStep1) || deploying}
                  >
                    NEXT STEP
                  </NeonButton>
                </motion.div>
              )}
            </div>
          </FadeInSection>
        )}
      </div>
    </div>
  )
}