/**
 * FloatingChat — Floating chat button available across all portal pages.
 * Provides quick access to Guardião IA without leaving the current page.
 * Preserves conversation during navigation.
 * Reuses the same API as the full chat pages.
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { streamAssociateMessage, streamAnalystMessage, createAssociateChatSession, createChatSession } from '../../api/client'

interface FMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
}

interface FloatingChatProps {
  userRole: 'associate' | 'analyst'
  transactionId?: number
  suggestedQuestions?: string[]
}

const DEFAULT_SUGGESTIONS_ASSOCIATE = [
  'Como me proteger de golpes?',
  'O que fazer com uma transação desconhecida?',
]

const DEFAULT_SUGGESTIONS_ANALYST = [
  'Quais alertas críticos estão pendentes?',
  'Explique os fatores de risco mais frequentes.',
]

export default function FloatingChat({ userRole, transactionId, suggestedQuestions }: FloatingChatProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<FMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [initializing, setInitializing] = useState(false)

  const cancelRef = useRef<(() => void) | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const token = localStorage.getItem('access_token') || ''
  const navigate = useNavigate()

  const suggestions = suggestedQuestions || (userRole === 'associate' ? DEFAULT_SUGGESTIONS_ASSOCIATE : DEFAULT_SUGGESTIONS_ANALYST)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const ensureSession = useCallback(async (): Promise<number | null> => {
    if (sessionId) return sessionId

    setInitializing(true)
    try {
      if (userRole === 'associate') {
        const r = await createAssociateChatSession()
        setSessionId(r.data.session_id)
        return r.data.session_id
      } else {
        // For analyst floating chat, use free session unless transactionId provided
        if (transactionId) {
          const r = await createChatSession(transactionId)
          setSessionId(r.data.session_id)
          return r.data.session_id
        } else {
          // Import lazily to avoid circular
          const { createFreeChatSession } = await import('../../api/client')
          const r = await createFreeChatSession()
          setSessionId(r.data.session_id)
          return r.data.session_id
        }
      }
    } catch {
      return null
    } finally {
      setInitializing(false)
    }
  }, [sessionId, userRole, transactionId])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return

    const sid = await ensureSession()
    if (!sid) return

    const msg: FMessage = { id: Date.now(), role: 'user', content: text }
    setMessages((prev) => [...prev, msg])
    setInput('')
    setStreaming(true)
    setStreamingText('')

    let accumulated = ''

    const streamFn = userRole === 'associate' ? streamAssociateMessage : streamAnalystMessage

    cancelRef.current = streamFn(
      sid,
      text,
      token,
      (tok) => { accumulated += tok; setStreamingText(accumulated) },
      () => {
        setStreaming(false)
        if (accumulated) {
          setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'assistant', content: accumulated }])
        }
        setStreamingText('')
        cancelRef.current = null
      },
      () => {
        setStreaming(false)
        setStreamingText('')
        setMessages((prev) => [...prev, {
          id: Date.now() + 1,
          role: 'assistant',
          content: '⚠️ O Guardião IA está temporariamente indisponível.',
        }])
        cancelRef.current = null
      },
    )
  }, [streaming, ensureSession, userRole, token])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') sendMessage(input)
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        title="Abrir Guardião IA"
        style={{
          position: 'fixed', right: 20, bottom: 20, zIndex: 500,
          width: 52, height: 52, borderRadius: '50%',
          background: '#005B2B', color: '#fff', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.4rem', boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)' }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.25)' }}
      >
        🤖
      </button>
    )
  }

  return (
    <div style={{
      position: 'fixed', right: 20, bottom: 20, zIndex: 500,
      width: 340, height: 460,
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 16, boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '0.75rem 1rem', background: '#1a1f2e',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
      }}>
        <div>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>🤖 Guardião IA</span>
          {transactionId && (
            <span style={{ marginLeft: '0.5rem', fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)' }}>Tx #{transactionId}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <button
            onClick={() => navigate(userRole === 'associate' ? '/associate/ai-chat' : '/analyst/ai-chat')}
            title="Expandir para página completa"
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', borderRadius: 6, padding: '0.2rem 0.4rem', fontSize: '0.72rem' }}
          >
            ⤢
          </button>
          <button
            onClick={() => setIsOpen(false)}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {messages.length === 0 && !streaming && (
          <div style={{ padding: '1rem 0.5rem' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem', textAlign: 'center' }}>
              {userRole === 'associate' ? '🛡️ Assistente de Segurança' : '🔍 Copiloto Antifraude'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {suggestions.map((q) => (
                <button key={q} onClick={() => sendMessage(q)} style={{
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '0.45rem 0.6rem', fontSize: '0.78rem',
                  cursor: 'pointer', textAlign: 'left', color: 'var(--text-primary)',
                }}>{q}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '88%', padding: '0.5rem 0.75rem',
              borderRadius: m.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
              background: m.role === 'user' ? '#005B2B' : 'var(--surface-2)',
              color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
              fontSize: '0.82rem', lineHeight: 1.5, whiteSpace: 'pre-wrap',
              border: m.role === 'assistant' ? '1px solid var(--border)' : 'none',
            }}>
              {m.content}
            </div>
          </div>
        ))}

        {streaming && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              maxWidth: '88%', padding: '0.5rem 0.75rem',
              borderRadius: '10px 10px 10px 2px',
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              fontSize: '0.82rem', lineHeight: 1.5, color: 'var(--text-primary)', whiteSpace: 'pre-wrap',
            }}>
              {streamingText || (
                <span style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                  {[0, 0.15, 0.3].map((d) => (
                    <span key={d} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--text-muted)', animation: 'pulse 1s ease infinite', animationDelay: `${d}s`, display: 'inline-block' }} />
                  ))}
                </span>
              )}
            </div>
          </div>
        )}

        {initializing && (
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>Iniciando conversa...</p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '0.6rem 0.75rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pergunte ao Guardião IA..."
          disabled={streaming || initializing}
          style={{
            flex: 1, padding: '0.5rem 0.75rem',
            border: '1.5px solid var(--border)', borderRadius: 20,
            fontSize: '0.82rem', outline: 'none',
            background: 'var(--surface)', color: 'var(--text-primary)',
          }}
        />
        {streaming ? (
          <button onClick={() => { cancelRef.current?.(); setStreaming(false); setStreamingText('') }} style={{ width: 34, height: 34, borderRadius: '50%', background: '#dc2626', border: 'none', cursor: 'pointer', color: '#fff', fontSize: '0.7rem', flexShrink: 0 }}>⏹</button>
        ) : (
          <button onClick={() => sendMessage(input)} disabled={!input.trim()} style={{
            width: 34, height: 34, borderRadius: '50%',
            background: input.trim() ? '#005B2B' : 'var(--surface-3)',
            border: 'none', cursor: input.trim() ? 'pointer' : 'not-allowed',
            color: '#fff', fontSize: '0.85rem', flexShrink: 0,
          }}>↑</button>
        )}
      </div>
    </div>
  )
}
