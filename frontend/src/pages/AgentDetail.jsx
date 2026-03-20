import React, { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import { useAccount } from 'wagmi'
import { formatEther } from 'viem'
import {
  ArrowLeft, Zap, Star, Activity, TrendingUp,
  Shield, Send, ThumbsUp, ThumbsDown,
  ExternalLink, Copy, CheckCircle, Clock, Cpu, Terminal,
  Gauge, Sparkles, MessageSquare, Network, FileText, AlertCircle, Table, Lock, ShoppingCart
} from 'lucide-react'
import GlassCard from '../components/ui/GlassCard'
import NeonButton from '../components/ui/NeonButton'
import TerminalBox from '../components/ui/TerminalBox'
import MetricBadge from '../components/ui/MetricBadge'
import LoadingPulse from '../components/ui/LoadingPulse'
import ReviewSection from '../components/ui/ReviewSection'
import AgentCommsPanel from '../components/ui/AgentcommsPanel'
import OutputRenderer from '../components/ui/OutputRenderer'
import { useInteractionStore } from '../stores/interactionStore'
import { agentsAPI } from '../api/agents'

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

const TABS = [
  { id: 'execute', label: 'EXECUTE', icon: Terminal },
  { id: 'comms', label: 'AGENT COMMS', icon: Network },
  { id: 'reviews', label: 'REVIEWS', icon: MessageSquare },
]

// ── Code Block Component (VS Code Dark+ Theme) ──────────────────
function SyntaxCodeBlock({ code, lang }) {
  const [copied, setCopied] = useState(false)

  const highlightSyntax = (text) => {
    if (!text) return ''
    let escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

    const tokens = []
    let tokenIndex = 0

    escaped = escaped.replace(/(\/\/.*|\/\*[\s\S]*?\*\/)/g, (match) => {
      const token = `__TOKEN_${tokenIndex++}__`
      tokens.push({ token, html: `<span style="color: #6A9955;">${match}</span>` })
      return token
    })

    escaped = escaped.replace(/(&quot;.*?&quot;|&#39;.*?&#39;|".*?"|'.*?')/g, (match) => {
      const token = `__TOKEN_${tokenIndex++}__`
      tokens.push({ token, html: `<span style="color: #ce9178;">${match}</span>` })
      return token
    })

    escaped = escaped
      .replace(/\b(if|else|while|for|return|break|continue|switch|case|default|try|catch|finally|throw)\b/g, '<span style="color: #c586c0;">$1</span>')
      .replace(/\b(public|private|protected|static|final|class|interface|enum|extends|implements|new|import|package|function|const|let|var|def)\b/g, '<span style="color: #569cd6;">$1</span>')
      .replace(/\b(void|int|boolean|double|float|char|long|short|byte|String|Object|System|Math)\b/g, '<span style="color: #4ec9b0;">$1</span>')
      .replace(/\b(\d+)\b/g, '<span style="color: #b5cea8;">$1</span>')
      .replace(/([a-zA-Z0-9_]+)(?=\s*\()/g, '<span style="color: #dcdcaa;">$1</span>')

    tokens.forEach(({ token, html }) => {
      escaped = escaped.replace(token, html)
    })

    return escaped
  }

  return (
    <div className="my-4 rounded-xl border border-[#333333] overflow-hidden bg-[#1e1e1e] shadow-lg">
      <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-[#404040]">
        <span className="text-[10px] font-mono text-[#cccccc] uppercase tracking-widest">{lang || 'CODE'}</span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(code)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-mono text-[#cccccc] hover:bg-[#404040] hover:text-white transition-all cursor-pointer"
        >
          {copied ? <CheckCircle size={12} className="text-[var(--color-success)]" /> : <Copy size={12} />}
          {copied ? 'COPIED' : 'COPY CODE'}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-[13px] font-mono leading-relaxed text-[#d4d4d4]">
        <code dangerouslySetInnerHTML={{ __html: highlightSyntax(code) }} />
      </pre>
    </div>
  )
}

// ── Inline CSV Table Component ───────────────────────────────────
function InlineCsvTable({ content }) {
  const [copied, setCopied] = useState(false)
  const lines = content.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const rows = lines.slice(1).map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, '')))

  return (
    <div className="my-4 rounded-xl border border-[#333333] overflow-hidden bg-[#1e1e1e] shadow-lg">
      <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-[#404040]">
        <div className="flex items-center gap-2">
          <Table size={13} className="text-[#4ec9b0]" />
          <span className="text-[10px] font-mono text-[#cccccc] uppercase tracking-widest">DATA TABLE</span>
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(content)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-mono text-[#cccccc] hover:bg-[#404040] hover:text-white transition-all cursor-pointer"
        >
          {copied ? <CheckCircle size={12} className="text-[var(--color-success)]" /> : <Copy size={12} />}
          {copied ? 'COPIED' : 'COPY CSV'}
        </button>
      </div>
      <div className="overflow-x-auto max-h-72 overflow-y-auto">
        <table className="w-full text-[12px] font-mono text-[#d4d4d4]">
          <thead className="sticky top-0 bg-[#252526] border-b border-[#404040]">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="text-left px-4 py-2.5 text-[#4ec9b0] font-bold whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-b border-[#333333] hover:bg-[#2a2d2e] transition-colors">
                {row.map((cell, ci) => (
                  <td key={ci} className="px-4 py-2 whitespace-nowrap">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Readable Text Renderer ─────────────────────────────────────
function extractText(response) {
  if (!response) return ''

  let parsed = response
  let rawString = ''

  if (typeof response === 'string') {
    rawString = response.trim()
    try {
      parsed = JSON.parse(rawString)
    } catch {
      return rawString.trim() 
    }
  }

  if (typeof parsed === 'object' && parsed !== null) {
    const textField =
      parsed.response ?? parsed.message ?? parsed.output ??
      parsed.text ?? parsed.content ?? parsed.result ?? parsed.answer ??
      parsed.summary ?? parsed.data

    if (textField && typeof textField === 'string') {
      return textField.trim() 
    }

    if (parsed.findings || parsed.riskLevel) {
      const lines = []
      if (parsed.summary) lines.push(`## Summary\n${parsed.summary}`)
      if (parsed.riskLevel) lines.push(`**Risk Level:** ${parsed.riskLevel}`)
      if (parsed.score !== undefined) lines.push(`**Score:** ${parsed.score}/100`)
      if (parsed.findings?.length) {
        lines.push('\n## Findings')
        parsed.findings.forEach(f => {
          lines.push(`### [${f.severity}] ${f.title}`)
          if (f.description) lines.push(f.description)
          if (f.recommendation) lines.push(`✓ ${f.recommendation}`)
        })
      }
      if (parsed.gasOptimizations?.length) {
        lines.push('\n## Gas Optimizations')
        parsed.gasOptimizations.forEach(g => lines.push(`- ${g}`))
      }
      if (parsed.passed?.length) {
        lines.push('\n## Passed Checks')
        parsed.passed.forEach(p => lines.push(`- ✓ ${p}`))
      }
      return lines.join('\n')
    }

    return Object.entries(parsed)
      .map(([k, v]) => `**${k.charAt(0).toUpperCase() + k.slice(1)}:** ${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join('\n')
  }

  return String(parsed).trim() 
}

function unescapeString(str) {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '')
}

function renderFormattedText(raw) {
  const text = unescapeString(raw)
  const lines = text.split('\n')
  const elements = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />)
      i++
      continue
    }

    // 1. Code Block Detection
    const codeBlockMatch = line.trim().match(/^(`{1,3})([a-zA-Z]*)$/)
    if (codeBlockMatch) {
      const delimiter = codeBlockMatch[1] 
      const lang = codeBlockMatch[2]     
      const codeLines = []
      i++
      
      while (i < lines.length && lines[i].trim() !== delimiter) {
        codeLines.push(lines[i])
        i++
      }
      
      elements.push(
        <SyntaxCodeBlock key={`code-block-${i}`} code={codeLines.join('\n')} lang={lang} />
      )
      i++
      continue
    }

    // 2. Markdown Table Detection
    const isMarkdownTable = line.trim().startsWith('|') && line.trim().endsWith('|');
    if (isMarkdownTable) {
      let j = i + 1;
      while (j < lines.length && lines[j].trim().startsWith('|') && lines[j].trim().endsWith('|')) {
        j++;
      }
      if ((j - i) >= 2) {
        const csvContent = lines.slice(i, j).map(l => {
          return l.split('|').map(c => c.trim()).filter((_, idx, arr) => idx !== 0 && idx !== arr.length - 1).join(',');
        }).filter(l => !l.replace(/,/g, '').match(/^[-:]+$/)).join('\n');
        
        elements.push(
          <InlineCsvTable key={`csv-md-${i}`} content={csvContent} />
        )
        i = j;
        continue;
      }
    }

    // 3. Raw CSV Table Detection
    const commas = (line.match(/,/g) || []).length;
    if (commas >= 1 && line.trim().length > 0) {
      let j = i + 1;
      while (j < lines.length && lines[j].trim() !== '' && (lines[j].match(/,/g) || []).length === commas) {
        j++;
      }
      if ((j - i) >= 3) {
        elements.push(
          <InlineCsvTable key={`csv-raw-${i}`} content={lines.slice(i, j).join('\n')} />
        )
        i = j;
        continue;
      }
    }

    // 4. Standard Markdown Formatting
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const content = headingMatch[2]

      if (level === 1) {
        elements.push(<h1 key={i} className="text-xl font-bold text-[var(--color-text-primary)] mt-6 mb-3">{inlineFormat(content)}</h1>)
      } else if (level === 2) {
        elements.push(<h2 key={i} className="text-lg font-bold text-[var(--color-text-primary)] mt-5 mb-2 pb-1 border-b border-[var(--color-border)]">{inlineFormat(content)}</h2>)
      } else {
        elements.push(<h3 key={i} className="text-[13px] font-bold text-[var(--color-purple-bright)] mt-4 mb-2">{inlineFormat(content)}</h3>)
      }
      i++; continue;
    }

    if (/^[-*•]\s+(.+)/.test(line)) {
      const items = []
      while (i < lines.length && /^[-*•]\s+(.+)/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*•]\s+/, ''))
        i++
      }
      elements.push(
        <ul key={`ul-${i}`} className="space-y-1.5 my-3 ml-1">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)] leading-relaxed">
              <span className="text-[var(--color-purple-bright)] mt-0.5 shrink-0">❖</span>
              <span>{inlineFormat(item)}</span>
            </li>
          ))}
        </ul>
      )
      continue
    }

    if (/^\d+\.\s+(.+)/.test(line)) {
      const items = []
      let startMatch = line.match(/^(\d+)/)
      let startIdx = startMatch ? parseInt(startMatch[1], 10) : 1
      
      while (i < lines.length && /^\d+\.\s+(.+)/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''))
        i++
      }
      elements.push(
        <ol key={`ol-${i}`} className="space-y-1.5 my-3 ml-1 list-none">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2.5 text-sm text-[var(--color-text-secondary)] leading-relaxed">
              <span className="text-[var(--color-purple-bright)] font-mono text-[11px] mt-0.5 shrink-0 min-w-[1.2rem]">{startIdx + idx}.</span>
              <span>{inlineFormat(item)}</span>
            </li>
          ))}
        </ol>
      )
      continue
    }

    if (/^>\s+(.+)/.test(line)) {
      elements.push(
        <blockquote key={i} className="border-l-2 border-[var(--color-purple-core)] pl-3 my-3 text-sm text-[var(--color-text-muted)] italic">
          {inlineFormat(line.replace(/^>\s+/, ''))}
        </blockquote>
      )
      i++; continue;
    }

    elements.push(
      <p key={i} className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-2">
        {inlineFormat(line)}
      </p>
    )
    i++
  }

  return elements
}

function inlineFormat(text) {
  const parts = []
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g
  let last = 0
  let match
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    if (match[0].startsWith('**')) {
      parts.push(<strong key={match.index} className="text-[var(--color-text-primary)] font-semibold">{match[2]}</strong>)
    } else if (match[0].startsWith('*')) {
      parts.push(<em key={match.index} className="text-[var(--color-text-muted)] italic">{match[3]}</em>)
    } else if (match[0].startsWith('`')) {
      parts.push(<code key={match.index} className="px-1.5 py-0.5 rounded bg-[rgba(124,58,237,0.12)] text-[var(--color-purple-pale)] font-mono text-[11px]">{match[4]}</code>)
    }
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length > 0 ? parts : text
}

function ReadableOutput({ response, success }) {
  const raw = extractText(response)
  const [copied, setCopied] = useState(false)

  if (!raw) return null

  const plainTextToCopy = unescapeString(raw)
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className={`rounded-xl border overflow-hidden ${
        success !== false
          ? 'border-[rgba(147,197,253,0.2)] bg-[rgba(147,197,253,0.02)]'
          : 'border-[rgba(248,113,113,0.2)] bg-[rgba(248,113,113,0.02)]'
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] bg-[rgba(0,0,0,0.3)]">
        <FileText size={13} className="text-[var(--color-star-blue)]" />
        <span className="text-[10px] font-mono font-bold text-[var(--color-star-blue)] tracking-widest">
          READABLE OUTPUT
        </span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(plainTextToCopy)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
          className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-mono text-[var(--color-text-dim)] hover:text-[var(--color-text-secondary)] hover:bg-[rgba(255,255,255,0.05)] transition-all cursor-pointer"
        >
          {copied
            ? <CheckCircle size={12} className="text-[var(--color-success)]" />
            : <Copy size={12} />
          }
          {copied ? 'COPIED' : 'COPY ALL'}
        </button>
      </div>

      <div className="p-5">
        {renderFormattedText(raw)}
      </div>
    </motion.div>
  )
}

export default function AgentDetail() {
  const { id } = useParams()
  
  // V1 Global Store (Persisting interaction logs/state)
  const { logs, addLog, clearLogs, isExecuting, setExecuting, executionResult, setResult } = useInteractionStore()
  
  // V2 Web3 State & Wagmi Logic
  const { address, isConnected } = useAccount()

  // Standard UI State
  const [agent, setAgent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [task, setTask] = useState('')
  const [voted, setVoted] = useState(null)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState('execute')
  const [toastMessage, setToastMessage] = useState(null)

  // Backend/Logic Access States (From Version 2)
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [isUpvoting, setIsUpvoting] = useState(false)
  const [purchaseType, setPurchaseType] = useState('monthly')
  const [hasValidAccess, setHasValidAccess] = useState(false)

  // Derived Access Logic
  const isOwner = agent?.ownerWallet?.toLowerCase() === address?.toLowerCase()
  const userHasAccess = hasValidAccess || isOwner

  const displayPriceEth = agent?.pricing ? formatEther(BigInt(agent.pricing)) : '0'

  const showToast = (message) => {
    setToastMessage(message)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const fetchAgentDetails = async () => {
    try {
      const response = await agentsAPI.getById(id)
      const agentData = response.data.agent || response.data
      setAgent(agentData)
      setVoted(response.data.userVote || null)
      
      // Secondary check for DB access bounds 
      if (isConnected) {
        const accessCheck = await agentsAPI.checkAccess(id).catch(() => ({ data: false }))
        setHasValidAccess(accessCheck.data || false)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Reset execution state when navigating to a different agent
    clearLogs()
    setResult(null)
    setTask('')
    setLoading(true)
    setAgent(null)

    fetchAgentDetails()
  }, [id, address])

  const handlePurchase = async () => {
    if (!isConnected) return
    setIsPurchasing(true)
    addLog({ level: 'system', message: 'Initiating backend purchase transaction...' })
    try {
      const isLifetime = purchaseType === 'lifetime'
      await agentsAPI.purchaseAccess(agent.agentId || agent.id || agent._id, isLifetime)
      await fetchAgentDetails()
      addLog({ level: 'success', message: `Access granted! Welcome to ${agent.name}.` })
      showToast("Access Unlocked Successfully!")
    } catch (error) {
      addLog({ level: 'error', message: `Purchase failed: ${error.response?.data?.error || error.message}` })
      showToast(`Purchase failed: ${error.response?.data?.error || error.message}`)
    } finally {
      setIsPurchasing(false)
    }
  }

  const handleExecute = async () => {
    if (!task.trim() || !isConnected) return
    setExecuting(true)
    setResult(null)
    addLog({ level: 'system', message: `Initiating execution: ${agent.name}` })
    addLog({ level: 'info', message: `Task: ${task}` })
    try {
      addLog({ level: 'info', message: 'Routing to agent endpoint...' })
      const response = await agentsAPI.execute(agent.agentId || agent.id || agent._id, task)
      addLog({ level: 'success', message: 'Agent responded successfully' })
      const data = response.data
      
      setResult({
        output: data.response || data.output || data.result || data || `Task completed.\n\n${new Date().toISOString()}`,
        latency: data.latency || Math.floor(Math.random() * 500) + 100,
        success: true,
      })
    } catch (error) {
      addLog({ level: 'error', message: `Failed: ${error.message}` })
      setResult({ output: `Error: ${error.message}`, latency: 0, success: false })
    } finally {
      setExecuting(false)
      setTask('')
    }
  }

  const handleVote = async (type) => {
    if (!isConnected) return
    
    if (isOwner) {
      showToast("You cannot vote on your own agent.")
      return
    }

    try {
      if (type === 'up') {
        setIsUpvoting(true)
        await agentsAPI.upvote(agent.agentId || agent.id || agent._id)
        setVoted('up')
      } else {
        await agentsAPI.vote(agent.agentId || agent.id || agent._id, 'down')
        setVoted('down')
      }
    } catch (e) {
      if (e.response?.data?.error) {
         showToast(e.response.data.error)
      } else {
         console.error(e)
      }
    } finally {
      setIsUpvoting(false)
    }
  }

  const copyEndpoint = () => {
    navigator.clipboard.writeText(agent?.endpoint || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <div className="p-6 max-w-6xl mx-auto"><LoadingPulse rows={8} /></div>
  if (!agent) return (
    <div className="relative min-h-[60vh] flex items-center justify-center p-6">
      <div className="glass-card-landing rounded-2xl p-10 text-center">
        <Zap size={40} className="mx-auto mb-4 text-[var(--color-purple-bright)] opacity-40" />
        <div className="text-[var(--color-text-muted)] text-lg font-display font-bold mb-2">AGENT NOT FOUND</div>
        <Link to="/marketplace" className="text-[var(--color-purple-bright)] text-xs font-mono hover:underline">← BACK TO MARKETPLACE</Link>
      </div>
    </div>
  )

  return (
    <div className="relative min-h-screen">
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-lg bg-[rgba(248,113,113,0.15)] border border-[var(--color-danger)] text-[var(--color-danger)] text-sm shadow-lg backdrop-blur-md">
           <AlertCircle size={16} />
           {toastMessage}
        </div>
      )}
      
      <div className="fixed top-20 right-10 w-[500px] h-[400px] rounded-full pointer-events-none opacity-25"
        style={{ background: 'radial-gradient(ellipse, rgba(124,58,237,0.08) 0%, transparent 70%)' }} />

      <div className="relative z-10 p-5 lg:p-8 max-w-6xl mx-auto">

        <Link to="/marketplace">
          <motion.div whileHover={{ x: -4 }} className="inline-flex items-center gap-2 text-[var(--color-text-dim)] hover:text-[var(--color-purple-bright)] text-[11px] font-mono tracking-widest mb-6 transition-colors cursor-pointer group">
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
            BACK TO MARKETPLACE
          </motion.div>
        </Link>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="glass-card-landing rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-[0_20px_60px_-15px_rgba(124,58,237,0.2)]">
            <div className="absolute top-0 right-0 w-[300px] h-[200px] rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(ellipse, rgba(124,58,237,0.08) 0%, transparent 70%)' }} />
            <div className="relative z-10 flex flex-col lg:flex-row items-start gap-6">
              <motion.div whileHover={{ scale: 1.05 }}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-[rgba(124,58,237,0.2)] to-[rgba(124,58,237,0.05)] border border-[rgba(124,58,237,0.3)] flex items-center justify-center shrink-0">
                <Cpu size={32} className="text-[var(--color-purple-bright)]" />
              </motion.div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <h1 className="font-display font-extrabold text-2xl sm:text-3xl lg:text-4xl text-[var(--color-text-primary)] tracking-tight">{agent.name}</h1>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(52,211,153,0.1)] border border-[rgba(52,211,153,0.25)]">
                    <span className="w-2 h-2 rounded-full bg-[var(--color-success)] pulse-dot" />
                    <span className="text-[10px] font-mono text-[var(--color-success)] tracking-widest font-bold">{(agent.status || 'ACTIVE').toUpperCase()}</span>
                  </div>
                </div>
                <p className="text-[var(--color-text-secondary)] text-sm sm:text-base mb-4 leading-relaxed max-w-2xl">{agent.description}</p>
                <div className="flex flex-wrap gap-2 mb-5">
                  {(agent.tags || []).map(tag => (
                    <span key={tag} className="px-3 py-1 rounded-lg text-[10px] font-mono bg-[rgba(124,58,237,0.06)] border border-[rgba(124,58,237,0.15)] text-[var(--color-purple-pale)]">#{tag}</span>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-[10px] font-mono text-[var(--color-text-dim)]">
                  <span>OWNER: <span className="text-[var(--color-purple-bright)]">{agent.ownerWallet?.slice(0, 12) || '0xUNKNOWN'}...</span></span>
                  <span>CATEGORY: <span className="text-[var(--color-text-muted)]">{agent.category || 'N/A'}</span></span>
                  <span>ID: <span className="text-[var(--color-text-muted)]">{agent.agentId || agent.id}</span></span>
                </div>
              </div>
            </div>
            
            <div className="relative z-10 mt-6 flex items-center gap-3 p-3 rounded-xl bg-black/30 border border-[var(--color-border)] font-mono text-[11px]">
              <ExternalLink size={13} className="text-[var(--color-text-dim)] shrink-0" />
              <span className="text-[var(--color-text-muted)] flex-1 truncate">
                {userHasAccess ? agent.endpoint : '******************************** (LOCKED)'}
              </span>
              {userHasAccess && (
                <button onClick={copyEndpoint} className="text-[var(--color-text-dim)] hover:text-[var(--color-purple-bright)] transition-colors cursor-pointer p-1">
                  {copied ? <CheckCircle size={14} className="text-[var(--color-success)]" /> : <Copy size={14} />}
                </button>
              )}
            </div>
          </div>
        </motion.div>

        <FadeInSection className="mb-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[
              { label: 'RATING', value: `${agent.rating || 0}/5.0`, color: 'yellow', icon: Star },
              { label: 'TOTAL CALLS', value: (agent.calls || 0).toLocaleString(), color: 'blue', icon: Activity },
              { label: 'SUCCESS RATE', value: `${agent.successRate || 0}%`, color: 'green', icon: TrendingUp },
              { label: 'PRICE', value: `${displayPriceEth} ETH`, color: 'purple', icon: Shield },
            ].map((m, i) => (
              <motion.div key={m.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}>
                <div className="glass-card-landing rounded-xl p-4 sm:p-5">
                  <MetricBadge {...m} />
                </div>
              </motion.div>
            ))}
          </div>
        </FadeInSection>

        <div className="flex gap-0 mb-6 glass-card-landing rounded-xl overflow-hidden border border-[var(--color-border)]">
          {TABS.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 font-mono text-[10px] tracking-widest border-b-2 transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'border-[var(--color-purple-bright)] text-[var(--color-purple-bright)] bg-[rgba(124,58,237,0.08)]'
                    : 'border-transparent text-[var(--color-text-dim)] hover:text-[var(--color-text-secondary)] hover:bg-[rgba(255,255,255,0.02)]'
                }`}
              >
                <Icon size={13} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            )
          })}
        </div>

        {activeTab === 'execute' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 lg:gap-6">
            <div className="lg:col-span-3 space-y-5">
              <FadeInSection>
                <div className="glass-card-landing rounded-xl p-5 sm:p-6 min-h-[300px]">
                  
                  <AnimatePresence mode="wait">
                    {userHasAccess ? (
                      <motion.div key="execute" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                        <h2 className="font-display font-bold text-base sm:text-lg text-[var(--color-text-primary)] mb-5 flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-[rgba(124,58,237,0.1)] border border-[rgba(124,58,237,0.2)] flex items-center justify-center">
                            <Terminal size={16} className="text-[var(--color-purple-bright)]" />
                          </div>
                          EXECUTION CONSOLE
                        </h2>
                        
                        <div className="mb-5">
                          <label className="text-[9px] font-mono text-[var(--color-text-dim)] tracking-[0.2em] uppercase block mb-2">TASK INPUT</label>
                          <textarea
                            value={task}
                            onChange={e => setTask(e.target.value)}
                            placeholder="Describe the task for this agent..."
                            rows={4}
                            className="input-field w-full px-4 py-3 rounded-xl text-sm resize-none focus:ring-2 focus:ring-[var(--color-purple-core)]/30 transition-all"
                          />
                        </div>
                        
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="text-[10px] font-mono text-[var(--color-text-dim)]">
                              STATUS: <span className="text-[var(--color-success)] font-bold text-sm">UNLOCKED</span>
                            </div>
                          </div>
                          <NeonButton icon={Send} onClick={handleExecute} loading={isExecuting} disabled={!isConnected || !task.trim()} className="w-full sm:w-auto">
                            {isConnected ? 'EXECUTE' : 'CONNECT WALLET'}
                          </NeonButton>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div key="paywall" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center text-center py-6">
                        <div className="w-16 h-16 rounded-2xl bg-[rgba(124,58,237,0.1)] border border-[rgba(124,58,237,0.25)] flex items-center justify-center mb-6">
                          <Lock size={32} className="text-[var(--color-purple-bright)]" />
                        </div>
                        <h2 className="font-display font-bold text-2xl text-[var(--color-text-primary)] mb-2">ACCESS REQUIRED</h2>
                        <p className="text-[var(--color-text-muted)] text-sm max-w-sm mb-8">Purchase an on-chain license to unlock the endpoint and interact with this agent. 80% goes to creator.</p>
                        
                        <div className="grid grid-cols-2 gap-4 w-full mb-8">
                          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setPurchaseType('monthly')} className={`p-4 rounded-xl border text-center transition-all ${purchaseType === 'monthly' ? 'bg-[rgba(124,58,237,0.15)] border-[var(--color-purple-bright)] shadow-[0_0_20px_rgba(124,58,237,0.2)]' : 'border-[var(--color-border)] hover:border-[var(--color-border-bright)] bg-black/20'}`}>
                            <div className="text-[10px] font-mono tracking-widest text-[var(--color-text-dim)] mb-2">30 DAYS</div>
                            <div className="text-xl font-bold font-display text-[var(--color-purple-bright)]">{displayPriceEth} <span className="text-xs">ETH</span></div>
                          </motion.button>

                          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setPurchaseType('lifetime')} className={`p-4 rounded-xl border text-center transition-all ${purchaseType === 'lifetime' ? 'bg-[rgba(52,211,153,0.15)] border-[var(--color-success)] shadow-[0_0_20px_rgba(52,211,153,0.2)]' : 'border-[var(--color-border)] hover:border-[var(--color-border-bright)] bg-black/20'}`}>
                            <div className="text-[10px] font-mono tracking-widest text-[var(--color-text-dim)] mb-2">LIFETIME (x12)</div>
                            <div className="text-xl font-bold font-display text-[var(--color-success)]">{(parseFloat(displayPriceEth) * 12).toFixed(4)} <span className="text-xs">ETH</span></div>
                          </motion.button>
                        </div>

                        <NeonButton icon={ShoppingCart} onClick={handlePurchase} loading={isPurchasing} disabled={!isConnected} className="w-full justify-center">
                          {isConnected ? `APPROVE & PURCHASE (${purchaseType.toUpperCase()})` : 'CONNECT WALLET TO PURCHASE'}
                        </NeonButton>
                      </motion.div>
                    )}
                  </AnimatePresence>

                </div>
              </FadeInSection>

              {/* Conditional Execution Results for Version 1 UI */}
              {userHasAccess && executionResult && (
                <FadeInSection delay={0.1}>
                  <div className="space-y-4">
                    <OutputRenderer
                      response={executionResult.output}
                      latency={executionResult.latency}
                      success={executionResult.success}
                      agentName={agent.name}
                    />
                    <ReadableOutput
                      response={executionResult.output}
                      success={executionResult.success}
                    />
                  </div>
                </FadeInSection>
              )}

              <FadeInSection delay={0.15}>
                <TerminalBox logs={logs} title={userHasAccess ? "EXECUTION LOG" : "SYSTEM LOGS"} />
              </FadeInSection>

            </div>

            <div className="lg:col-span-2 space-y-5">
              <FadeInSection delay={0.1}>
                <div className="glass-card-landing rounded-xl p-5 sm:p-6">
                  <h3 className="font-mono text-[10px] tracking-[0.2em] text-[var(--color-text-dim)] uppercase mb-4 flex items-center gap-2">
                    <Sparkles size={12} className="text-[var(--color-purple-bright)]" /> CAPABILITIES
                  </h3>
                  <div className="space-y-2.5">
                    {['Natural Language Processing', 'Real-time Analysis', 'Multi-format Input', 'Streaming Output', 'Context Window 128K', 'Agent Composition'].map((cap, i) => (
                      <motion.div key={cap} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.05 }}
                        className="flex items-center gap-2.5 text-xs text-[var(--color-text-muted)] cursor-default">
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-purple-bright)] shrink-0" />
                        {cap}
                      </motion.div>
                    ))}
                  </div>
                </div>
              </FadeInSection>

              <FadeInSection delay={0.15}>
                <div className="glass-card-landing rounded-xl p-5 sm:p-6">
                  <h3 className="font-mono text-[10px] tracking-[0.2em] text-[var(--color-text-dim)] uppercase mb-4">VOTE ON AGENT</h3>
                  <p className="text-[9px] font-mono text-[var(--color-text-dim)] mb-3 leading-relaxed">
                    * Upvoting transfers 1 AGT directly to the creator.
                  </p>
                  <div className="flex gap-3">
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => handleVote('up')} disabled={isUpvoting}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border transition-all font-mono text-xs cursor-pointer ${
                        voted === 'up' ? 'bg-[rgba(52,211,153,0.15)] border-[var(--color-success)] text-[var(--color-success)] shadow-[0_0_15px_rgba(52,211,153,0.2)]'
                        : 'border-[var(--color-border)] text-[var(--color-text-dim)] hover:border-[rgba(52,211,153,0.4)] hover:text-[var(--color-success)]'
                      }`}>
                      {isUpvoting ? <LoadingPulse rows={0} /> : <><ThumbsUp size={15} /> UPVOTE</>}
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => handleVote('down')}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border transition-all font-mono text-xs cursor-pointer ${
                        voted === 'down' ? 'bg-[rgba(248,113,113,0.15)] border-[var(--color-danger)] text-[var(--color-danger)] shadow-[0_0_15px_rgba(248,113,113,0.2)]'
                        : 'border-[var(--color-border)] text-[var(--color-text-dim)] hover:border-[rgba(248,113,113,0.4)] hover:text-[var(--color-danger)]'
                      }`}>
                      <ThumbsDown size={15} /> DOWNVOTE
                    </motion.button>
                  </div>
                </div>
              </FadeInSection>

              <FadeInSection delay={0.2}>
                <div className="glass-card-landing rounded-xl p-5 sm:p-6">
                  <h3 className="font-mono text-[10px] tracking-[0.2em] text-[var(--color-text-dim)] uppercase mb-5 flex items-center gap-2">
                    <Gauge size={12} className="text-[var(--color-star-blue)]" /> PERFORMANCE
                  </h3>
                  <div className="space-y-4">
                    {[
                      { label: 'Avg Latency', value: `${agent.metrics?.avgLatency || 234}ms`, bar: 80, color: 'from-blue-500 to-blue-400' },
                      { label: 'Uptime', value: '99.9%', bar: 99, color: 'from-emerald-500 to-emerald-400' },
                      { label: 'Success Rate', value: `${agent.successRate || 0}%`, bar: agent.successRate || 0, color: 'from-purple-500 to-purple-400' },
                    ].map((stat, i) => (
                      <div key={stat.label}>
                        <div className="flex justify-between text-[10px] font-mono mb-1.5">
                          <span className="text-[var(--color-text-dim)]">{stat.label}</span>
                          <span className="text-[var(--color-text-muted)] font-bold">{stat.value}</span>
                        </div>
                        <div className="h-1.5 bg-[var(--color-nebula-deep)] rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${stat.bar}%` }}
                            transition={{ delay: 0.6 + i * 0.1, duration: 0.8 }}
                            className={`h-full rounded-full bg-gradient-to-r ${stat.color}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </FadeInSection>
            </div>
          </div>
        )}

        {activeTab === 'comms' && (
          <FadeInSection>
            <AgentCommsPanel agentId={agent.agentId || agent.id} agentName={agent.name} />
          </FadeInSection>
        )}

        {activeTab === 'reviews' && (
          <FadeInSection>
            <div className="glass-card-landing rounded-xl p-5 sm:p-6">
              <ReviewSection agentId={agent.agentId || agent.id} />
            </div>
          </FadeInSection>
        )}

      </div>
    </div>
  )
}