/**
 * Associate AI Chat Page — Guardião IA para Associados
 * Features:
 *   - Streaming SSE responses from Ollama via backend
 *   - Persistent session history
 *   - Session management (create, delete)
 *   - Suggested questions
 *   - AI status indicator
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import AssociateLayout from '../../components/layout/AssociateLayout'
import { Button, Card, Modal } from '../../components/ui/index'
import {
  createAssociateChatSession, listAssociateChatSessions,
  deleteAssociateChatSession, getAssociateChatMessages,
  streamAssociateMessage,
} from '../../api/client'

interface Message {
  id: number
  role: 'user' | 'assistant'
  content: string
  ts: Date
}

interface SessionSummary {
  id: number
  title: string
  message_count: number
  created_at: string
}

const SUGGESTIONS = [
  'Como identificar um golpe pelo WhatsApp?',
  'O que fazer se recebi uma transferência suspeita?',
  'Como proteger minha senha e dados?',
  'Por que uma transação pode ser bloqueada?',
  'Quais são os sinais de uma tentativa de fraude?',
]

export default function AssociateAIChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [aiStatus, setAiStatus] = useState<'idle' | 'thinking' | 'unavailable'>('idle')
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null)
  const [showSidebar, setShowSidebar] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<SessionSummary | null>(null)
  const [error, setError] = useState('')

  const bottomRef = useRef<HTMLDivElement>(null)
  const cancelStreamRef = useRef<(() => void) | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const token = localStorage.getItem('access_token') || ''

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  // Load sessions on mount
  useEffect(() => {
    listAssociateChatSessions()
      .then((r) => setSessions(r.data as SessionSummary[]))
      .catch(() => {})
  }, [])

  const startNewSession = useCallback(async () => {
    setError('')
    try {
      const r = await createAssociateChatSession()
      setCurrentSessionId(r.data.session_id)
      setMessages([])
      setStreamingText('')
      setSessions((prev) => [
        { id: r.data.session_id, title: r.data.title, message_count: 0, created_at: r.data.created_at },
        ...prev,
      ])
    } catch {
      setError('Erro ao criar nova conversa.')
    }
  }, [])

  const loadSession = useCallback(async (session: SessionSummary) => {
    setShowSidebar(false)
    setError('')
    setCurrentSessionId(session.id)
    setMessages([])
    setStreamingText('')
    try {
      const r = await getAssociateChatMessages(session.id)
      const msgs = (r.data as { id: number; role: 'user' | 'assistant'; content: string; created_at: string }[])
        .map((m) => ({ ...m, ts: new Date(m.created_at) }))
      setMessages(msgs)
    } catch { setError('Erro ao carregar histórico.') }
  }, [])

  const handleDeleteSession = async () => {
    if (!deleteConfirm) return
    try {
      await deleteAssociateChatSession(deleteConfirm.id)
      setSessions((prev) => prev.filter((s) => s.id !== deleteConfirm.id))
      if (currentSessionId === deleteConfirm.id) {
        setCurrentSessionId(null)
        setMessages([])
      }
    } catch { setError('Erro ao excluir conversa.') }
    setDeleteConfirm(null)
  }

  const sendMessage = async (text: string) => {
    if (!text.trim() || streaming) return

    // Ensure we have a session
    let sessionId = currentSessionId
    if (!sessionId) {
      try {
        const r = await createAssociateChatSession()
        sessionId = r.data.session_id
        setCurrentSessionId(sessionId)
        setSessions((prev) => [
          { id: r.data.session_id, title: r.data.title, message_count: 0, created_at: r.data.created_at },
          ...prev,
        ])
      } catch {
        setError('Erro ao iniciar conversa.')
        return
      }
    }

    const userMsg: Message = { id: Date.now(), role: 'user', content: text.trim(), ts: new Date() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setStreaming(true)
    setStreamingText('')
    setAiStatus('thinking')
    setError('')

    let accumulated = ''

    cancelStreamRef.current = streamAssociateMessage(
      sessionId as number,
      text.trim(),
      token,
      (tok) => { accumulated += tok; setStreamingText(accumulated) },
      () => {
        setStreaming(false)
        setAiStatus('idle')
        const finalText = accumulated
        if (finalText) {
          setMessages((prev) => [
            ...prev,
            { id: Date.now() + 1, role: 'assistant', content: finalText, ts: new Date() },
          ])
        }
        setStreamingText('')
        accumulated = ''
        cancelStreamRef.current = null
        // Refresh sessions
        listAssociateChatSessions().then((r) => setSessions(r.data as SessionSummary[])).catch(() => {})
      },
      (err) => {
        setStreaming(false)
        setAiStatus('unavailable')
        setStreamingText('')
        setError(err || 'O assistente está temporariamente indisponível.')
        cancelStreamRef.current = null
      },
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const cancelStream = () => {
    cancelStreamRef.current?.()
    cancelStreamRef.current = null
    setStreaming(false)
    setAiStatus('idle')
    if (streamingText) {
      setMessages((prev) => [...prev, { id: Date.now(), role: 'assistant', content: streamingText + ' [interrompido]', ts: new Date() }])
      setStreamingText('')
    }
  }

  const statusColor = aiStatus === 'thinking' ? 'var(--yellow-600)' : aiStatus === 'unavailable' ? '#ef4444' : 'var(--green-600)'
  const statusLabel = aiStatus === 'thinking' ? 'Guardião IA processando...' : aiStatus === 'unavailable' ? 'Guardião IA indisponível' : 'Guardião IA disponível'

  return (
    <AssociateLayout>
      {/* Delete confirm modal */}
      {deleteConfirm && (
        <Modal title="Excluir conversa" onClose={() => setDeleteConfirm(null)}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>Excluir "{deleteConfirm.title}"? Esta ação não pode ser desfeita.</p>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button onClick={() => setDeleteConfirm(null)} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>Cancelar</button>
            <button onClick={handleDeleteSession} style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: 8, background: '#dc2626', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Excluir</button>
          </div>
        </Modal>
      )}

      {/* Sessions sidebar overlay */}
      {showSidebar && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowSidebar(false)} />
          <div style={{ position: 'relative', width: 280, background: 'var(--surface)', height: '100vh', display: 'flex', flexDirection: 'column', padding: '1.25rem', gap: '0.75rem', overflowY: 'auto', boxShadow: '4px 0 20px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Conversas</span>
              <button onClick={() => setShowSidebar(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text-muted)' }}>×</button>
            </div>
            <button onClick={() => { setShowSidebar(false); startNewSession() }} style={{ padding: '0.5rem', background: '#005B2B', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>+ Nova conversa</button>
            {sessions.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nenhuma conversa salva.</p>
            ) : sessions.map((s) => (
              <div key={s.id} style={{ border: `1px solid ${currentSessionId === s.id ? '#005B2B' : 'var(--border)'}`, borderRadius: 8, overflow: 'hidden', background: currentSessionId === s.id ? '#e8f5ee' : 'var(--surface-2)' }}>
                <button onClick={() => loadSession(s)} style={{ width: '100%', padding: '0.65rem 0.75rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s.message_count} mensagens</div>
                </button>
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  <button onClick={() => setDeleteConfirm(s)} style={{ width: '100%', padding: '0.3rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.72rem', color: '#ef4444' }}>🗑 Excluir</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              🛡️ Guardião IA
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              Assistente de Segurança Financeira
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setShowSidebar(true)} style={{ padding: '0.4rem 0.85rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              💬 Conversas ({sessions.length})
            </button>
            {messages.length > 0 && (
              <Button variant="secondary" size="sm" onClick={startNewSession}>Nova conversa</Button>
            )}
          </div>
        </div>

        {/* AI Status bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          marginBottom: '0.75rem', padding: '0.45rem 0.75rem',
          background: 'var(--surface-2)', borderRadius: 8,
          fontSize: '0.8rem', color: 'var(--text-secondary)',
          border: '1px solid var(--border)',
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', background: statusColor,
            animation: aiStatus === 'thinking' ? 'pulse 1s ease infinite' : 'none',
            display: 'inline-block',
          }} />
          {statusLabel}
          <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Protótipo — não substitui orientação oficial Sicredi
          </span>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '0.65rem 0.9rem', marginBottom: '0.75rem', fontSize: '0.85rem', color: '#dc2626' }}>
            {error}
            <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontWeight: 700 }}>×</button>
          </div>
        )}

        {/* Chat area */}
        <Card style={{ minHeight: 400, display: 'flex', flexDirection: 'column', padding: 0 }}>
          <div style={{ flex: 1, padding: '1.25rem', overflowY: 'auto', maxHeight: 450, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {messages.length === 0 && !streaming && (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🛡️</div>
                <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Como posso ajudar você?</p>
                <p style={{ fontSize: '0.875rem', marginBottom: '1.5rem' }}>Tire dúvidas sobre segurança financeira, golpes e proteção da sua conta.</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => sendMessage(s)}
                      style={{
                        padding: '0.45rem 0.9rem',
                        background: 'var(--surface-2)', border: '1px solid var(--border)',
                        borderRadius: 20, fontSize: '0.8rem', cursor: 'pointer',
                        color: 'var(--text-primary)',
                      }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                {msg.role === 'assistant' && (
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'var(--green-700)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.9rem', flexShrink: 0, marginRight: '0.75rem', marginTop: '0.15rem',
                  }}>🤖</div>
                )}
                <div style={{
                  maxWidth: '75%', padding: '0.75rem 1rem',
                  borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: msg.role === 'user' ? 'var(--green-700)' : 'var(--surface-2)',
                  color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                  fontSize: '0.9rem', lineHeight: 1.6,
                  border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
                  whiteSpace: 'pre-wrap',
                }}>
                  {msg.content}
                  <div style={{ fontSize: '0.68rem', opacity: 0.6, marginTop: '0.25rem', textAlign: 'right' }}>
                    {msg.ts.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}

            {/* Streaming message */}
            {streaming && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'var(--green-700)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.9rem', flexShrink: 0,
                }}>🤖</div>
                <div style={{
                  maxWidth: '75%', padding: '0.75rem 1rem', borderRadius: '14px 14px 14px 4px',
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-primary)', whiteSpace: 'pre-wrap',
                }}>
                  {streamingText || (
                    <span style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                      {[0, 0.15, 0.3].map((delay) => (
                        <span key={delay} style={{
                          width: 7, height: 7, borderRadius: '50%',
                          background: 'var(--text-muted)',
                          animation: 'pulse 1s ease infinite',
                          animationDelay: `${delay}s`,
                          display: 'inline-block',
                        }} />
                      ))}
                    </span>
                  )}
                  {streamingText && (
                    <span style={{ display: 'inline-block', width: 2, height: '1em', background: 'var(--green-700)', marginLeft: 1, animation: 'pulse 0.8s ease infinite', verticalAlign: 'text-bottom' }} />
                  )}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div style={{ borderTop: '1px solid var(--border)', padding: '0.9rem 1.25rem' }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'
                }}
                onKeyDown={handleKeyDown}
                placeholder="Faça uma pergunta sobre segurança financeira... (Enter para enviar)"
                disabled={streaming}
                rows={1}
                style={{
                  flex: 1, padding: '0.65rem 1rem',
                  border: '1.5px solid var(--border)', borderRadius: 24,
                  fontSize: '0.9rem', outline: 'none', resize: 'none',
                  background: 'var(--surface)', color: 'var(--text-primary)',
                  minHeight: 42, maxHeight: 100,
                }}
              />
              {streaming ? (
                <button type="button" onClick={cancelStream} style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: '#dc2626', border: 'none', cursor: 'pointer',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', flexShrink: 0,
                }}>⏹</button>
              ) : (
                <button type="submit" disabled={!input.trim()}
                  style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: input.trim() ? 'var(--green-700)' : 'var(--surface-3)',
                    border: 'none', cursor: input.trim() ? 'pointer' : 'not-allowed',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1rem', flexShrink: 0,
                  }}>
                  ↑
                </button>
              )}
            </form>
          </div>
        </Card>

        <p style={{ marginTop: '0.75rem', fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          Guardião IA é um assistente educativo. Para emergências, entre em contato com a Sicredi pelo 0800 724 4200.
        </p>
      </div>
    </AssociateLayout>
  )
}
