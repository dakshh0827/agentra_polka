import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Heart, MessageSquare, Trash2, ChevronDown, ChevronUp,
  Send, Star, User, Reply, Loader2, AlertCircle
} from 'lucide-react'
import api from '../../api/axios'
import { useAuthStore } from '../../stores/authStore'

// ── API helpers ───────────────────────────────────────────────
const reviewsAPI = {
  get: (agentId, page = 1) => api.get(`/agents/${agentId}/reviews`, { params: { page } }),
  create: (agentId, data) => api.post(`/agents/${agentId}/reviews`, data),
  like: (reviewId) => api.post(`/reviews/${reviewId}/like`),
  delete: (reviewId) => api.delete(`/reviews/${reviewId}`),
}

// ── Single Review Component ───────────────────────────────────
function ReviewItem({ review, agentId, currentWallet, onLike, onReply, onDelete, depth = 0 }) {
  const [showReplies, setShowReplies] = useState(depth < 2)
  const [replying, setReplying] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const isOwner = review.authorWallet === currentWallet
  const isLiked = review.likes?.includes(currentWallet)
  const maxDepth = 3

  const handleReplySubmit = async () => {
    if (!replyText.trim() || submitting) return
    setSubmitting(true)
    try {
      await onReply(replyText, review.id)
      setReplyText('')
      setReplying(false)
      setShowReplies(true)
    } finally {
      setSubmitting(false)
    }
  }

  const depthStyles = [
    '',
    'border-l-2 border-[rgba(124,58,237,0.2)] pl-4',
    'border-l-2 border-[rgba(124,58,237,0.12)] pl-4',
    'border-l-2 border-[rgba(124,58,237,0.06)] pl-4',
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${depth > 0 ? depthStyles[Math.min(depth, 3)] + ' mt-3' : ''}`}
    >
      <div className={`rounded-xl p-4 ${depth === 0 ? 'bg-[rgba(255,255,255,0.025)] border border-[var(--color-border)]' : 'bg-[rgba(255,255,255,0.015)]'}`}>
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[rgba(124,58,237,0.12)] border border-[rgba(124,58,237,0.2)] flex items-center justify-center shrink-0">
              <User size={14} className="text-[var(--color-purple-bright)]" />
            </div>
            <div>
              <div className="font-mono text-[11px] text-[var(--color-purple-bright)]">
                {review.authorWallet.slice(0, 6)}...{review.authorWallet.slice(-4)}
                {isOwner && <span className="ml-1.5 text-[9px] text-[var(--color-text-dim)] font-mono">(you)</span>}
              </div>
              <div className="text-[9px] text-[var(--color-text-dim)] font-mono">
                {new Date(review.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Star rating if present */}
            {review.rating > 0 && (
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={11}
                    className={i < review.rating ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-dim)]'}
                    fill={i < review.rating ? 'var(--color-warning)' : 'none'}
                  />
                ))}
              </div>
            )}
            {/* Delete */}
            {isOwner && (
              <button
                onClick={() => onDelete(review.id)}
                className="text-[var(--color-text-dim)] hover:text-[var(--color-danger)] transition-colors p-1 rounded cursor-pointer"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed mb-3 whitespace-pre-wrap break-words">
          {review.content}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-4">
          {/* Like */}
          {currentWallet && (
            <button
              onClick={() => onLike(review.id)}
              className={`flex items-center gap-1.5 text-[11px] font-mono transition-all cursor-pointer group ${
                isLiked ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-dim)] hover:text-[var(--color-danger)]'
              }`}
            >
              <Heart
                size={13}
                fill={isLiked ? 'currentColor' : 'none'}
                className="group-hover:scale-125 transition-transform"
              />
              <span>{review.likes?.length || 0}</span>
            </button>
          )}

          {/* Reply */}
          {currentWallet && depth < maxDepth && (
            <button
              onClick={() => setReplying(!replying)}
              className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--color-text-dim)] hover:text-[var(--color-purple-bright)] transition-colors cursor-pointer"
            >
              <Reply size={13} />
              Reply
            </button>
          )}

          {/* Toggle replies */}
          {review.replies?.length > 0 && (
            <button
              onClick={() => setShowReplies(!showReplies)}
              className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--color-text-dim)] hover:text-[var(--color-text-secondary)] transition-colors cursor-pointer ml-auto"
            >
              <MessageSquare size={13} />
              {review.replies.length} {review.replies.length === 1 ? 'reply' : 'replies'}
              {showReplies ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
          )}
        </div>

        {/* Reply input */}
        <AnimatePresence>
          {replying && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 pt-3 border-t border-[var(--color-border)]"
            >
              <div className="flex gap-2">
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Write a reply..."
                  rows={2}
                  className="input-field flex-1 px-3 py-2 rounded-lg text-sm resize-none"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && e.metaKey) handleReplySubmit()
                  }}
                />
                <button
                  onClick={handleReplySubmit}
                  disabled={!replyText.trim() || submitting}
                  className="px-3 py-2 rounded-lg bg-[var(--color-purple-core)] text-white disabled:opacity-40 hover:bg-[var(--color-purple-bright)] transition-colors cursor-pointer self-end"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </div>
              <div className="text-[9px] font-mono text-[var(--color-text-dim)] mt-1">⌘+Enter to submit</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nested replies */}
      <AnimatePresence>
        {showReplies && review.replies?.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-2 space-y-2"
          >
            {review.replies.map(reply => (
              <ReviewItem
                key={reply.id}
                review={reply}
                agentId={agentId}
                currentWallet={currentWallet}
                onLike={onLike}
                onReply={onReply}
                onDelete={onDelete}
                depth={depth + 1}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Star Rating Input ─────────────────────────────────────────
function StarRatingInput({ value, onChange }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i + 1 === value ? 0 : i + 1)}
          onMouseEnter={() => setHovered(i + 1)}
          onMouseLeave={() => setHovered(0)}
          className="cursor-pointer transition-transform hover:scale-125"
        >
          <Star
            size={18}
            className={i < (hovered || value) ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-dim)]'}
            fill={i < (hovered || value) ? 'var(--color-warning)' : 'none'}
          />
        </button>
      ))}
      {value > 0 && (
        <span className="text-[10px] font-mono text-[var(--color-text-dim)] ml-1">({value}/5)</span>
      )}
    </div>
  )
}

// ── Main ReviewSection ────────────────────────────────────────
export default function ReviewSection({ agentId }) {
  const { walletAddress, isConnected } = useAuthStore()
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [newRating, setNewRating] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalLikes, setTotalLikes] = useState(0)
  const [error, setError] = useState(null)

  const fetchReviews = useCallback(async (p = 1) => {
    setLoading(true)
    setError(null)
    try {
      const res = await reviewsAPI.get(agentId, p)
      setReviews(p === 1 ? res.data.reviews : prev => [...prev, ...res.data.reviews])
      setTotalPages(res.data.pages)
      setTotalLikes(res.data.totalLikes)
    } catch (e) {
      setError('Failed to load reviews')
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => { fetchReviews(1) }, [fetchReviews])

  const handleSubmit = async () => {
    if (!newComment.trim() || submitting) return
    setSubmitting(true)
    try {
      await reviewsAPI.create(agentId, { content: newComment, rating: newRating })
      setNewComment('')
      setNewRating(0)
      fetchReviews(1)
    } catch (e) {
      setError('Failed to post review')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLike = async (reviewId) => {
    if (!walletAddress) return
    try {
      const res = await reviewsAPI.like(reviewId)
      // Optimistically update likes in tree
      setReviews(prev => updateReviewLikes(prev, reviewId, walletAddress, res.data.liked))
      setTotalLikes(prev => prev + (res.data.liked ? 1 : -1))
    } catch (e) { /* ignore */ }
  }

  const handleReply = async (content, parentId) => {
    await reviewsAPI.create(agentId, { content, parentId })
    fetchReviews(1)
  }

  const handleDelete = async (reviewId) => {
    if (!window.confirm('Delete this comment?')) return
    try {
      await reviewsAPI.delete(reviewId)
      fetchReviews(1)
    } catch (e) { /* ignore */ }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-display font-bold text-lg text-[var(--color-text-primary)] flex items-center gap-2">
            <MessageSquare size={18} className="text-[var(--color-purple-bright)]" />
            Reviews & Discussion
          </h3>
          <span className="px-2.5 py-1 rounded-lg bg-[rgba(124,58,237,0.08)] border border-[rgba(124,58,237,0.2)] text-[10px] font-mono text-[var(--color-purple-bright)]">
            {reviews.length} comments
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--color-text-dim)]">
          <Heart size={12} className="text-[var(--color-danger)]" fill="var(--color-danger)" />
          {totalLikes} likes
        </div>
      </div>

      {/* New review form */}
      {isConnected ? (
        <div className="glass-card-landing rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-[rgba(124,58,237,0.12)] border border-[rgba(124,58,237,0.2)] flex items-center justify-center">
              <User size={14} className="text-[var(--color-purple-bright)]" />
            </div>
            <span className="font-mono text-[11px] text-[var(--color-purple-bright)]">
              {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
            </span>
          </div>
          <div className="mb-3">
            <div className="text-[9px] font-mono text-[var(--color-text-dim)] mb-2 tracking-widest">RATING (OPTIONAL)</div>
            <StarRatingInput value={newRating} onChange={setNewRating} />
          </div>
          <textarea
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder="Share your experience with this agent..."
            rows={3}
            className="input-field w-full px-4 py-3 rounded-xl text-sm resize-none mb-3"
          />
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono text-[var(--color-text-dim)]">
              {newComment.length}/5000
            </span>
            <button
              onClick={handleSubmit}
              disabled={!newComment.trim() || submitting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-purple-core)] text-white text-[11px] font-mono disabled:opacity-40 hover:bg-[var(--color-purple-bright)] transition-colors cursor-pointer"
            >
              {submitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              POST REVIEW
            </button>
          </div>
        </div>
      ) : (
        <div className="glass-card-landing rounded-xl p-5 text-center">
          <MessageSquare size={24} className="mx-auto mb-2 text-[var(--color-text-dim)] opacity-40" />
          <p className="text-[var(--color-text-muted)] text-sm font-mono">Connect wallet to write a review</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-[var(--color-danger)] text-sm p-3 rounded-lg bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.2)]">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Reviews list */}
      {loading && reviews.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl p-4 bg-[rgba(255,255,255,0.02)] animate-pulse">
              <div className="flex gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--color-nebula-deep)]" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3 w-24 bg-[var(--color-nebula-deep)] rounded" />
                  <div className="h-2 w-16 bg-[var(--color-nebula-deep)] rounded" />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="h-3 w-full bg-[var(--color-nebula-deep)] rounded" />
                <div className="h-3 w-2/3 bg-[var(--color-nebula-deep)] rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-10">
          <MessageSquare size={32} className="mx-auto mb-3 text-[var(--color-text-dim)] opacity-20" />
          <div className="text-[var(--color-text-dim)] text-sm font-mono">No reviews yet. Be the first!</div>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {reviews.map(review => (
              <ReviewItem
                key={review.id}
                review={review}
                agentId={agentId}
                currentWallet={walletAddress}
                onLike={handleLike}
                onReply={handleReply}
                onDelete={handleDelete}
                depth={0}
              />
            ))}
          </AnimatePresence>

          {page < totalPages && (
            <button
              onClick={() => {
                const next = page + 1
                setPage(next)
                fetchReviews(next)
              }}
              disabled={loading}
              className="w-full py-3 rounded-xl border border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text-secondary)] hover:border-[var(--color-border-bright)] font-mono text-[11px] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />}
              LOAD MORE REVIEWS
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Helper: update likes in nested review tree ────────────────
function updateReviewLikes(reviews, reviewId, wallet, liked) {
  return reviews.map(r => {
    if (r.id === reviewId) {
      const likes = liked
        ? [...(r.likes || []), wallet]
        : (r.likes || []).filter(w => w !== wallet)
      return { ...r, likes }
    }
    if (r.replies?.length) {
      return { ...r, replies: updateReviewLikes(r.replies, reviewId, wallet, liked) }
    }
    return r
  })
}