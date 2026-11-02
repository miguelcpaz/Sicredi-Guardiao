/**
 * Alert Detail Page — full alert with actions + Guardião AI
 */
import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Bot, Search, Send } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import AnalystLayout from '../../components/layout/AnalystLayout'
import {
  Card, Spinner, RiskBadge, StatusBadge, Button, AlertBox,
  Modal, Input, formatCurrency, formatDate,
} from '../../components/ui/index'
import { getAlertDetail, takeAlertAction, createChatSession, sendChatMessage, getChatMessages } from '../../api/client'
import type { AlertDetail, ChatMessage } from '../../api/client'

const ACTIONS = [
  { key: 'maintain_block', label: 'Manter Bloqueio', description: 'Mantém o bloqueio atual e pode enviar notificação ao associado.' },
  { key: 'request_confirmation', label: 'Solicitar Confirmação', description: 'Envia uma solicitação de confirmação para o associado.' },
  { key: 'escalate_investigation', label: 'Investigar', description: 'Encaminha o caso para investigação aprofundada.' },
  { key: 'resolve', label: 'Resolver', description: 'Marca o alerta como resolvido.' },
]

export default function AlertDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const alertId = parseInt(id ?? '0', 10)

  const [data, setData] = useState<AlertDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Action modal
  const [actionModal, setActionModal] = useState<string | null>(null)
  const [justification, setJustification] = useState('')
  const [notifMessage, setNotifMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // AI Chat
  const [chatOpen, setChatOpen] = useState(false)
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatProvider, setChatProvider] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  const SUGGESTED_QUESTIONS = [
    'Por que essa transação foi considerada suspeita?',
    'Quais fatores mais contribuíram para o risco?',
    'O valor é atípico para esse associado?',
    'Que verificações você recomenda?',
    'Resuma esta ocorrência.',
  ]

  useEffect(() => {
    if (!alertId) return
    getAlertDetail(alertId)
      .then((r) => setData(r.data))
      .catch(() => setError('Erro ao carregar alerta.'))
      .finally(() => setLoading(false))
  }, [alertId])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleAction = async () => {
    if (!actionModal) return
    setSubmitting(true)
    try {
      await takeAlertAction(alertId, actionModal, {
        justification,
        notification_message: notifMessage,
      })
      setSuccessMsg(`Ação "${ACTIONS.find((a) => a.key === actionModal)?.label}" executada com sucesso.`)
      setActionModal(null)
      setJustification('')
      setNotifMessage('')
      // Reload
      const r = await getAlertDetail(alertId)
      setData(r.data)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail || 'Erro ao executar ação.')
    } finally {
      setSubmitting(false)
    }
  }

  const openChat = async () => {
    if (!data?.transaction.id) return
    setChatOpen(true)
    if (sessionId) {
      const r = await getChatMessages(sessionId)
      setMessages(r.data)
      return
    }
    setChatLoading(true)
    try {
      const sessionResp = await createChatSession(data.transaction.id)
      const sid = sessionResp.data.session_id
      setSessionId(sid)
      if (!sessionResp.data.is_new) {
        const msgsResp = await getChatMessages(sid)
        setMessages(msgsResp.data)
      }
    } catch { /* ignore */ }
    finally { setChatLoading(false) }
  }

  const sendMsg = async (msg?: string) => {
    const text = (msg || chatInput).trim()
    if (!text || !sessionId) return
    setChatInput('')
    const userMsg: ChatMessage = { id: Date.now(), role: 'user', content: text, created_at: new Date().toISOString() }
    setMessages((prev) => [...prev, userMsg])
    setChatLoading(true)
    try {
      const r = await sendChatMessage(sessionId, text)
      const aiMsg: ChatMessage = { id: Date.now() + 1, role: 'assistant', content: r.data.reply, created_at: new Date().toISOString() }
      setMessages((prev) => [...prev, aiMsg])
      setChatProvider(r.data.provider)
    } catch { /* ignore */ }
    finally { setChatLoading(false) }
  }

  if (loading) return (
    <AnalystLayout>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <Spinner size={36} />
      </div>
    </AnalystLayout>
  )

  if (error && !data) return (
    <AnalystLayout>
      <AlertBox type="error" message={error} />
    </AnalystLayout>
  )

  if (!data) return null

  const { alert, transaction, associate, risk_analysis } = data

  return (
    <AnalystLayout>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        <button onClick={() => navigate('/analyst/alerts')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--green-600)', fontWeight: 600 }}>
          ← Alertas
        </button>
        <span>/</span>
        <span>Alerta #{alert.id}</span>
      </div>

      {successMsg && <AlertBox type="success" message={successMsg} onClose={() => setSuccessMsg('')} style={{ marginBottom: '1rem' }} />}
      {error && <AlertBox type="error" message={error} onClose={() => setError('')} style={{ marginBottom: '1rem' }} />}

      <div className="alert-detail-grid">
        {/* Left: main content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Alert summary */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Alerta #{alert.id}
                  </h2>
                  <RiskBadge level={alert.risk_level} score={alert.risk_score} />
                  <StatusBadge status={alert.status} />
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  Registrado em {formatDate(alert.created_at)}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Button onClick={openChat} variant="ghost">
                  <Bot size={15} style={{ marginRight: '0.35rem' }} />
                  Chat rápido
                </Button>
                <Button
                  onClick={() => navigate(`/analyst/ai-chat?transaction_id=${transaction.id}`)}
                  variant="primary"
                >
                  <Search size={15} style={{ marginRight: '0.35rem' }} />
                  Analisar com Guardião AI
                </Button>
              </div>
            </div>

            {/* Transaction details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              {[
                { label: 'Associado', value: associate.full_name },
                { label: 'Conta', value: associate.account_number },
                { label: 'Destinatário', value: transaction.merchant },
                { label: 'Valor', value: formatCurrency(transaction.amount) },
                { label: 'Modalidade', value: transaction.mode.toUpperCase() },
                { label: 'Data/Hora', value: formatDate(transaction.timestamp) },
                { label: 'Status da Transação', value: <StatusBadge status={transaction.status} /> },
                { label: 'Resposta do Associado', value: alert.response
                  ? (alert.response === 'confirmed' ? '✓ Reconheceu' : '✗ Não reconheceu')
                  : 'Aguardando' },
              ].map(({ label, value }) => (
                <div key={label} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--surface-2)' }}>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0 0 0.2rem' }}>{label}</p>
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>{value as string}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Risk analysis */}
          {risk_analysis && (
            <Card>
              <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '0.95rem' }}>
                Análise de Risco
              </h3>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Score</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 800, color: risk_analysis.risk_level === 'high' ? 'var(--red-600)' : risk_analysis.risk_level === 'medium' ? 'var(--yellow-600)' : 'var(--green-600)' }}>
                    {risk_analysis.risk_score}<span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-secondary)' }}>/100</span>
                  </p>
                </div>
                <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Provider</p>
                  <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{risk_analysis.provider}</p>
                </div>
              </div>

              {/* Triggered signals */}
              <div>
                <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  Fatores de Risco Ativos
                </p>
                {risk_analysis.signals.filter((s) => s.triggered).length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Nenhum fator ativo.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {risk_analysis.signals.filter((s) => s.triggered).map((s) => (
                      <div key={s.rule_id} style={{
                        background: 'var(--red-100)', border: '1px solid var(--red-200)',
                        borderRadius: 'var(--radius-sm)', padding: '0.6rem 0.75rem',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--red-600)' }}>
                            {s.rule_name.replace(/_/g, ' ')}
                          </span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>+{s.score_contribution} pts</span>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>{s.evidence}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Right: actions panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Card>
            <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '0.95rem' }}>
              Ações Disponíveis
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {ACTIONS.map((action) => (
                <button
                  key={action.key}
                  onClick={() => setActionModal(action.key)}
                  style={{
                    padding: '0.7rem 1rem',
                    background: action.key === 'escalate_investigation' ? 'var(--blue-100)' :
                      action.key === 'resolve' ? 'var(--green-100)' : 'var(--surface)',
                    border: `1px solid ${action.key === 'escalate_investigation' ? 'var(--blue-200)' :
                      action.key === 'resolve' ? 'var(--green-200)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = action.key === 'escalate_investigation' ? 'var(--blue-100)' : action.key === 'resolve' ? 'var(--green-100)' : 'var(--surface)' }}
                >
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                    {action.label}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    {action.description}
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* Incidents */}
          {data.incidents.length > 0 && (
            <Card>
              <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
                Investigações
              </h3>
              {data.incidents.map((inc) => (
                <div key={inc.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                  <StatusBadge status={inc.status} />
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>{inc.description}</p>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{formatDate(inc.created_at)}</p>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>

      {/* Action modal */}
      {actionModal && (
        <Modal
          title={ACTIONS.find((a) => a.key === actionModal)?.label ?? ''}
          onClose={() => setActionModal(null)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {(actionModal === 'maintain_block' || actionModal === 'request_confirmation' || actionModal === 'escalate_investigation') && (
              <>
                <Input
                  label="Mensagem para o associado (opcional)"
                  value={notifMessage}
                  onChange={setNotifMessage}
                  placeholder="Escreva uma mensagem para o associado..."
                />
                <Input
                  label="Justificativa interna (opcional)"
                  value={justification}
                  onChange={setJustification}
                  placeholder="Registre a motivação para esta ação..."
                />
              </>
            )}
            {actionModal === 'resolve' && (
              <Input
                label="Justificativa"
                value={justification}
                onChange={setJustification}
                placeholder="Descreva o motivo para resolver este alerta..."
              />
            )}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <Button variant="secondary" onClick={() => setActionModal(null)} fullWidth>Cancelar</Button>
              <Button onClick={handleAction} disabled={submitting} fullWidth>
                {submitting ? 'Processando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* AI Chat panel */}
      {chatOpen && (
        <div className="quick-chat-panel">
          {/* Header */}
          <div style={{
            padding: '1rem 1.25rem',
            background: 'var(--sidebar-analyst-bg)', color: 'var(--sidebar-analyst-text)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexShrink: 0,
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}>
                <Bot size={16} />
                Guardião AI
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--sidebar-analyst-muted)' }}>
                {chatProvider ? `Provider: ${chatProvider}` : 'Assistente de Investigação'}
              </div>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              aria-label="Fechar chat"
              style={{ background: 'none', border: 'none', color: 'var(--sidebar-analyst-muted)', cursor: 'pointer', fontSize: '1.3rem', lineHeight: 1 }}
            >×</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', minHeight: 0 }}>
            {messages.length === 0 && !chatLoading && (
              <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                  Pergunte ao Guardião AI sobre esta transação.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMsg(q)}
                      style={{
                        background: 'var(--surface-2)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem',
                        fontSize: '0.82rem', cursor: 'pointer', textAlign: 'left', color: 'var(--text-primary)',
                        transition: 'background 0.15s',
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}
              >
                <div style={{
                  maxWidth: '88%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  background: m.role === 'user' ? 'var(--green-600)' : 'var(--surface-2)',
                  color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
                  fontSize: '0.875rem', lineHeight: 1.5,
                  border: m.role === 'assistant' ? '1px solid var(--border)' : 'none',
                }}>
                  {m.role === 'assistant' ? (
                    <div className="guardiao-md guardiao-md--sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    </div>
                  ) : m.content}
                </div>
              </div>
            ))}

            {chatLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Spinner size={16} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Guardião AI pensando...</span>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '0.75rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg() } }}
              placeholder="Pergunte ao Guardião AI..."
              style={{
                flex: 1, padding: '0.6rem 0.75rem',
                border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)',
                fontSize: '0.875rem', outline: 'none',
                background: 'var(--input-bg)',
                color: 'var(--text-primary)',
                minWidth: 0,
              }}
            />
            <button
              onClick={() => sendMsg()}
              disabled={!chatInput.trim() || chatLoading}
              style={{
                width: 38, height: 38,
                background: 'var(--green-600)', color: '#fff',
                border: 'none', borderRadius: 'var(--radius-sm)',
                cursor: chatInput.trim() && !chatLoading ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: !chatInput.trim() || chatLoading ? 0.6 : 1,
                flexShrink: 0,
              }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </AnalystLayout>
  )
}
