/**
 * Guardião AI Chat Page — Copiloto Antifraude para Analistas
 * Features:
 *   - Streaming SSE responses from Ollama via backend
 *   - Sessions sidebar with history (create, rename, delete)
 *   - Transaction context from alert details
 *   - Suggested questions per context
 *   - AI status indicator
 *   - Dark mode support
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import AnalystLayout from '../../components/layout/AnalystLayout'
import { Card, Spinner, AlertBox, RiskBadge, formatCurrency, Modal } from '../../components/ui/index'
import {
  listAnalystAlerts, createChatSession, createFreeChatSession,
  getChatMessages, listChatSessions, renameChatSession, deleteChatSession,
  getAIStatus, streamAnalystMessage,
} from '../../api/client'
import type { ChatMessage } from '../../api/client'
import { useAuth } from '../../hooks/useAuth'

interface AlertSummary {
  id: number
  risk_score: number
  risk_level: string
  amount: number | null
  merchant: string | null
  associate_name: string | null
  transaction_id: number
}

interface SessionSummary {
  id: number
  transaction_id: number | null
  title: string
  message_count: number
  created_at: string
}

type AIStatus = 'available' | 'unavailable' | 'checking' | 'processing'

const SUGGESTED_GENERAL = [
  'Quais alertas críticos estão pendentes na minha carteira?',
  'Explique os fatores de risco mais frequentes.',
  'Como interpretar um score de risco alto?',
]

const SUGGESTED_TRANSACTION = [
  'Por que essa transação foi classificada como suspeita?',
  'Quais fatores contribuíram para o score de risco?',
  'O valor é atípico para esse associado?',
  'Que verificações você recomenda?',
  'Resuma as evidências desta ocorrência.',
  'Sugira os próximos passos para investigar.',
]

export default function AIChatPage() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const [alerts, setAlerts] = useState<AlertSummary[]>([])
  const [loadingAlerts, setLoadingAlerts] = useState(true)
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [selectedSession, setSelectedSession] = useState<SessionSummary | null>(null)
  const [selectedAlert, setSelectedAlert] = useState<AlertSummary | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [error, setError] = useState('')
  const [aiStatus, setAiStatus] = useState<AIStatus>('checking')
  const [aiProvider, setAiProvider] = useState('')
  const [renamingSession, setRenamingSession] = useState<SessionSummary | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<SessionSummary | null>(null)
  const [sidebarTab, setSidebarTab] = useState<'alerts' | 'sessions'>('alerts')

  const chatEndRef = useRef<HTMLDivElement>(null)
  const cancelStreamRef = useRef<(() => void) | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const token = localStorage.getItem('access_token') || ''

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  // Check AI status on mount
  useEffect(() => {
    getAIStatus()
      .then((r) => {
        const s = r.data.status
        setAiStatus(s === 'available' ? 'available' : 'unavailable')
        setAiProvider(r.data.provider || '')
      })
      .catch(() => setAiStatus('unavailable'))
  }, [])

  // Load alerts and sessions
  useEffect(() => {
    listAnalystAlerts()
      .then((r) => {
        const alertsData = (r.data as AlertSummary[])
          .filter((a) => a.risk_level === 'high' || a.risk_level === 'medium')
        setAlerts(alertsData.slice(0, 15))
      })
      .finally(() => setLoadingAlerts(false))

    listChatSessions()
      .then((r) => setSessions(r.data as SessionSummary[]))
      .catch(() => {})
  }, [])

  // Handle deep-link from AlertDetailPage: ?transaction_id=X
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const txId = params.get('transaction_id')
    if (txId) {
      const alertMatch = alerts.find((a) => String(a.transaction_id) === txId)
      if (alertMatch) {
        startSessionForAlert(alertMatch)
        navigate('/analyst/ai-chat', { replace: true })
      }
    }
  }, [location.search, alerts])

  const loadSession = useCallback(async (session: SessionSummary) => {
    setSelectedSession(session)
    setMessages([])
    setError('')
    setStreamingText('')
    if (session.message_count > 0) {
      try {
        const r = await getChatMessages(session.id)
        setMessages(r.data)
      } catch { setError('Erro ao carregar histórico.') }
    }
    // Find associated alert if any
    if (session.transaction_id) {
      const a = alerts.find((al) => al.transaction_id === session.transaction_id)
      setSelectedAlert(a || null)
    } else {
      setSelectedAlert(null)
    }
  }, [alerts])

  const startSessionForAlert = async (alert: AlertSummary) => {
    setError('')
    setStreamingText('')
    try {
      const r = await createChatSession(alert.transaction_id)
      const newSession: SessionSummary = {
        id: r.data.session_id,
        transaction_id: alert.transaction_id,
        title: r.data.title || `Análise: ${alert.associate_name}`,
        message_count: r.data.message_count,
        created_at: r.data.created_at,
      }
      setSelectedSession(newSession)
      setSelectedAlert(alert)
      setMessages([])
      if (!r.data.is_new) {
        const msgs = await getChatMessages(r.data.session_id)
        setMessages(msgs.data)
      }
      // Refresh sessions list
      listChatSessions().then((r) => setSessions(r.data as SessionSummary[])).catch(() => {})
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail || 'Erro ao iniciar sessão de análise.')
    }
  }

  const startFreeSession = async () => {
    setError('')
    setStreamingText('')
    try {
      const r = await createFreeChatSession()
      const newSession: SessionSummary = {
        id: r.data.session_id,
        transaction_id: null,
        title: r.data.title,
        message_count: 0,
        created_at: r.data.created_at,
      }
      setSelectedSession(newSession)
      setSelectedAlert(null)
      setMessages([])
      listChatSessions().then((r) => setSessions(r.data as SessionSummary[])).catch(() => {})
    } catch {
      setError('Erro ao criar nova conversa.')
    }
  }

  const sendMsg = async (text?: string) => {
    const msg = (text || input).trim()
    if (!msg || !selectedSession || streaming) return
    setInput('')
    setError('')

    const userMsg: ChatMessage = {
      id: Date.now(),
      role: 'user',
      content: msg,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setStreaming(true)
    setStreamingText('')
    setAiStatus('processing')

    cancelStreamRef.current = streamAnalystMessage(
      selectedSession.id,
      msg,
      token,
      (token) => setStreamingText((prev) => prev + token),
      () => {
        setStreaming(false)
        setAiStatus('available')
        setStreamingText((prev) => {
          if (prev) {
            setMessages((m) => [
              ...m,
              { id: Date.now() + 1, role: 'assistant', content: prev, created_at: new Date().toISOString() },
            ])
          }
          return ''
        })
        cancelStreamRef.current = null
        // Refresh sessions count
        listChatSessions().then((r) => setSessions(r.data as SessionSummary[])).catch(() => {})
      },
      (err) => {
        setStreaming(false)
        setAiStatus('unavailable')
        setStreamingText('')
        setError(err || 'Erro ao comunicar com o Guardião AI.')
        cancelStreamRef.current = null
      },
    )
  }

  const cancelStream = () => {
    cancelStreamRef.current?.()
    cancelStreamRef.current = null
    setStreaming(false)
    setAiStatus('available')
    if (streamingText) {
      setMessages((m) => [
        ...m,
        {
          id: Date.now(),
          role: 'assistant',
          content: streamingText + ' [geração interrompida]',
          created_at: new Date().toISOString(),
        },
      ])
      setStreamingText('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMsg()
    }
  }

  const handleRename = async () => {
    if (!renamingSession || !renameValue.trim()) return
    try {
      await renameChatSession(renamingSession.id, renameValue.trim())
      setSessions((prev) =>
        prev.map((s) => s.id === renamingSession.id ? { ...s, title: renameValue.trim() } : s)
      )
      if (selectedSession?.id === renamingSession.id) {
        setSelectedSession((prev) => prev ? { ...prev, title: renameValue.trim() } : prev)
      }
    } catch { setError('Erro ao renomear conversa.') }
    setRenamingSession(null)
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    try {
      await deleteChatSession(deleteConfirm.id)
      setSessions((prev) => prev.filter((s) => s.id !== deleteConfirm.id))
      if (selectedSession?.id === deleteConfirm.id) {
        setSelectedSession(null)
        setMessages([])
        setSelectedAlert(null)
      }
    } catch { setError('Erro ao excluir conversa.') }
    setDeleteConfirm(null)
  }

  const aiStatusColor = { available: '#22c55e', unavailable: '#ef4444', checking: '#f59e0b', processing: '#3b82f6' }[aiStatus]
  const aiStatusLabel = { available: 'Disponível', unavailable: 'Indisponível', checking: 'Verificando...', processing: 'Processando...' }[aiStatus]
  const suggestions = selectedAlert ? SUGGESTED_TRANSACTION : SUGGESTED_GENERAL

  return (
    <AnalystLayout>
      {/* Rename modal */}
      {renamingSession && (
        <Modal title="Renomear conversa" onClose={() => setRenamingSession(null)}>
          <input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            style={{ width: '100%', padding: '0.6rem', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '0.9rem', background: 'var(--surface)', color: 'var(--text-primary)' }}
            autoFocus
          />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
            <button onClick={() => setRenamingSession(null)} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>Cancelar</button>
            <button onClick={handleRename} style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: 8, background: '#005B2B', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Salvar</button>
          </div>
        </Modal>
      )}

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <Modal title="Excluir conversa" onClose={() => setDeleteConfirm(null)}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>Excluir "{deleteConfirm.title}"? Esta ação não pode ser desfeita.</p>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button onClick={() => setDeleteConfirm(null)} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>Cancelar</button>
            <button onClick={handleDelete} style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: 8, background: '#dc2626', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Excluir</button>
          </div>
        </Modal>
      )}

      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>🤖 Guardião AI — Copiloto Antifraude</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
            Assistente de investigação — dados autorizados da sua carteira
          </p>
        </div>
        {/* AI status pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.35rem 0.75rem', borderRadius: 20,
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          fontSize: '0.78rem', color: 'var(--text-secondary)',
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: aiStatusColor, display: 'inline-block' }} />
          {aiStatusLabel}
          {aiProvider && <span style={{ opacity: 0.5, marginLeft: 4 }}>· {aiProvider}</span>}
        </div>
      </div>

      {error && <AlertBox type="error" message={error} onClose={() => setError('')} style={{ marginBottom: '1rem' }} />}

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.25rem', height: 'calc(100vh - 210px)' }}>

        {/* Left sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflow: 'hidden' }}>
          {/* New chat + tabs */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={startFreeSession} style={{
              flex: 1, padding: '0.5rem', background: '#005B2B', color: '#fff',
              border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
            }}>+ Nova conversa</button>
          </div>

          {/* Tab switcher */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '0.25rem' }}>
            {(['alerts', 'sessions'] as const).map((tab) => (
              <button key={tab} onClick={() => setSidebarTab(tab)} style={{
                flex: 1, padding: '0.45rem', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: sidebarTab === tab ? 700 : 400,
                background: 'none', color: sidebarTab === tab ? '#005B2B' : 'var(--text-secondary)',
                borderBottom: sidebarTab === tab ? '2px solid #005B2B' : '2px solid transparent',
              }}>
                {tab === 'alerts' ? '⚠ Alertas' : '💬 Conversas'}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {sidebarTab === 'alerts' ? (
              loadingAlerts ? <Spinner size={20} /> : alerts.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', padding: '1rem' }}>Nenhum alerta disponível.</p>
              ) : alerts.map((a) => (
                <button key={a.id} onClick={() => startSessionForAlert(a)} style={{
                  background: selectedAlert?.id === a.id ? '#e8f5ee' : 'var(--surface)',
                  border: `1px solid ${selectedAlert?.id === a.id ? '#005B2B' : 'var(--border)'}`,
                  borderRadius: 8, padding: '0.6rem 0.75rem', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', width: '100%',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{a.associate_name}</span>
                    <RiskBadge level={a.risk_level} score={a.risk_score} />
                  </div>
                  <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.merchant} · {a.amount !== null ? formatCurrency(a.amount) : ''}
                  </div>
                </button>
              ))
            ) : (
              sessions.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', padding: '1rem' }}>Nenhuma conversa salva.</p>
              ) : sessions.map((s) => (
                <div key={s.id} style={{
                  background: selectedSession?.id === s.id ? '#e8f5ee' : 'var(--surface)',
                  border: `1px solid ${selectedSession?.id === s.id ? '#005B2B' : 'var(--border)'}`,
                  borderRadius: 8, overflow: 'hidden',
                }}>
                  <button onClick={() => loadSession(s)} style={{
                    width: '100%', padding: '0.6rem 0.75rem', cursor: 'pointer', textAlign: 'left',
                    background: 'none', border: 'none',
                  }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s.message_count} mensagens</div>
                  </button>
                  <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
                    <button onClick={() => { setRenamingSession(s); setRenameValue(s.title) }} style={{ flex: 1, padding: '0.3rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.7rem', color: 'var(--text-muted)' }}>✏ Renomear</button>
                    <button onClick={() => setDeleteConfirm(s)} style={{ flex: 1, padding: '0.3rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.7rem', color: '#ef4444' }}>🗑 Excluir</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat area */}
        <Card style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: 0 }}>
          {!selectedSession ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', color: 'var(--text-secondary)', padding: '2rem' }}>
              <div style={{ fontSize: '3rem' }}>🤖</div>
              <p style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Guardião AI — Copiloto Antifraude</p>
              <p style={{ fontSize: '0.875rem', textAlign: 'center', maxWidth: 400 }}>
                Selecione um alerta à esquerda para analisar uma transação específica, ou inicie uma nova conversa geral.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', maxWidth: 500 }}>
                {SUGGESTED_GENERAL.map((q) => (
                  <button key={q} onClick={async () => { await startFreeSession(); }} style={{
                    padding: '0.45rem 0.85rem', background: 'var(--surface-2)',
                    border: '1px solid var(--border)', borderRadius: 20,
                    fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-primary)',
                  }}>{q}</button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', background: '#1a1f2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>{selectedSession.title}</span>
                  {selectedAlert && (
                    <span style={{ marginLeft: '0.75rem', fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>
                      Score: {selectedAlert.risk_score}/100 · {selectedAlert.risk_level}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {aiProvider && (
                    <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.08)', padding: '0.2rem 0.5rem', borderRadius: 10 }}>
                      {aiProvider}
                    </span>
                  )}
                  <button onClick={() => { setSelectedSession(null); setMessages([]); setSelectedAlert(null) }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '0.8rem' }}>
                    Nova análise
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {messages.length === 0 && !streaming && (
                  <div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Sugestões de perguntas:</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {suggestions.map((q) => (
                        <button key={q} onClick={() => sendMsg(q)} style={{
                          background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8,
                          padding: '0.5rem 0.75rem', fontSize: '0.82rem', cursor: 'pointer', textAlign: 'left', color: 'var(--text-primary)',
                          transition: 'border-color 0.15s',
                        }}>{q}</button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((m) => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', gap: '0.5rem', alignItems: 'flex-start' }}>
                    {m.role === 'assistant' && (
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#005B2B', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', flexShrink: 0, marginTop: 2 }}>🤖</div>
                    )}
                    <div style={{
                      maxWidth: '82%', padding: '0.65rem 0.9rem',
                      borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                      background: m.role === 'user' ? '#005B2B' : 'var(--surface-2)',
                      color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
                      fontSize: '0.875rem', lineHeight: 1.6, whiteSpace: 'pre-wrap',
                      border: m.role === 'assistant' ? '1px solid var(--border)' : 'none',
                    }}>
                      {m.content}
                    </div>
                    {m.role === 'user' && (
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#374151', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', flexShrink: 0, marginTop: 2 }}>
                        {user?.full_name?.charAt(0) || 'A'}
                      </div>
                    )}
                  </div>
                ))}

                {/* Streaming indicator */}
                {streaming && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#005B2B', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', flexShrink: 0, marginTop: 2 }}>🤖</div>
                    <div style={{ maxWidth: '82%', padding: '0.65rem 0.9rem', borderRadius: '12px 12px 12px 2px', background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: '0.875rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>
                      {streamingText || (
                        <span style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                          {[0, 0.15, 0.3].map((d) => (
                            <span key={d} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--text-muted)', animation: 'pulse 1s ease infinite', animationDelay: `${d}s`, display: 'inline-block' }} />
                          ))}
                        </span>
                      )}
                      {streamingText && <span style={{ display: 'inline-block', width: 2, height: '1em', background: '#005B2B', marginLeft: 1, animation: 'pulse 0.8s ease infinite', verticalAlign: 'text-bottom' }} />}
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div style={{ borderTop: '1px solid var(--border)', padding: '0.75rem 1.25rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value)
                      e.target.style.height = 'auto'
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Pergunte ao Guardião AI... (Enter para enviar, Shift+Enter para nova linha)"
                    disabled={streaming}
                    rows={1}
                    style={{
                      flex: 1, padding: '0.6rem 0.8rem', border: '1.5px solid var(--border)',
                      borderRadius: 10, fontSize: '0.875rem', outline: 'none', resize: 'none',
                      background: 'var(--surface)', color: 'var(--text-primary)', lineHeight: 1.5,
                      minHeight: 40, maxHeight: 120,
                    }}
                  />
                  {streaming ? (
                    <button onClick={cancelStream} style={{
                      padding: '0.6rem 0.9rem', background: '#dc2626', color: '#fff',
                      border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', flexShrink: 0,
                    }}>⏹ Parar</button>
                  ) : (
                    <button onClick={() => sendMsg()} disabled={!input.trim()} style={{
                      padding: '0.6rem 1rem', background: input.trim() ? '#005B2B' : 'var(--surface-3)',
                      color: '#fff', border: 'none', borderRadius: 10, cursor: input.trim() ? 'pointer' : 'not-allowed',
                      fontWeight: 600, flexShrink: 0,
                    }}>→</button>
                  )}
                </div>
                <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.35rem', textAlign: 'center' }}>
                  Guardião AI é um assistente consultivo. Nenhuma resposta autoriza alterações financeiras automaticamente.
                </p>
              </div>
            </>
          )}
        </Card>
      </div>
    </AnalystLayout>
  )
}
