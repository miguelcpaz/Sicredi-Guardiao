/**
 * Alert Detail Page — full alert with actions + Guardião AI
 */
import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '0.85rem', color: '#6b7280' }}>
        <button onClick={() => navigate('/analyst/alerts')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#005B2B', fontWeight: 600 }}>
          ← Alertas
        </button>
        <span>/</span>
        <span>Alerta #{alert.id}</span>
      </div>

      {successMsg && <AlertBox type="success" message={successMsg} onClose={() => setSuccessMsg('')} style={{ marginBottom: '1rem' }} />}
      {error && <AlertBox type="error" message={error} onClose={() => setError('')} style={{ marginBottom: '1rem' }} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left: main content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Alert summary */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1f2328' }}>
                    Alerta #{alert.id}
                  </h2>
                  <RiskBadge level={alert.risk_level} score={alert.risk_score} />
                  <StatusBadge status={alert.status} />
                </div>
                <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>
                  Registrado em {formatDate(alert.created_at)}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Button onClick={openChat} variant="ghost">
                  🤖 Chat rápido
                </Button>
                <Button
                  onClick={() => navigate(`/analyst/ai-chat?transaction_id=${transaction.id}`)}
                  variant="primary"
                >
                  🔍 Analisar com Guardião AI
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
                  ? (alert.response === 'confirmed' ? '✅ Reconheceu' : '❌ Não reconheceu')
                  : '⏳ Aguardando' },
              ].map(({ label, value }) => (
                <div key={label} style={{ padding: '0.5rem 0', borderBottom: '1px solid #f9fafb' }}>
                  <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0 0 0.2rem' }}>{label}</p>
                  <p style={{ fontWeight: 600, color: '#1f2328', fontSize: '0.875rem' }}>{value as string}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Risk analysis */}
          {risk_analysis && (
            <Card>
              <h3 style={{ fontWeight: 700, color: '#1f2328', marginBottom: '1rem', fontSize: '0.95rem' }}>
                Análise de Risco
              </h3>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <div style={{ background: '#f9fafb', borderRadius: 8, padding: '0.75rem 1rem' }}>
                  <p style={{ fontSize: '0.72rem', color: '#9ca3af' }}>Score</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 800, color: risk_analysis.risk_level === 'high' ? '#dc2626' : risk_analysis.risk_level === 'medium' ? '#d97706' : '#005B2B' }}>
                    {risk_analysis.risk_score}<span style={{ fontSize: '0.85rem', fontWeight: 400, color: '#6b7280' }}>/100</span>
                  </p>
                </div>
                <div style={{ background: '#f9fafb', borderRadius: 8, padding: '0.75rem 1rem' }}>
                  <p style={{ fontSize: '0.72rem', color: '#9ca3af' }}>Provider</p>
                  <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{risk_analysis.provider}</p>
                </div>
              </div>

              {/* Triggered signals */}
              <div>
                <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1f2328', marginBottom: '0.5rem' }}>
                  Fatores de Risco Ativos
                </p>
                {risk_analysis.signals.filter((s) => s.triggered).length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>Nenhum fator ativo.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {risk_analysis.signals.filter((s) => s.triggered).map((s) => (
                      <div key={s.rule_id} style={{
                        background: '#fff9f9', border: '1px solid #fecaca',
                        borderRadius: 6, padding: '0.6rem 0.75rem',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.82rem', color: '#dc2626' }}>
                            {s.rule_name.replace(/_/g, ' ')}
                          </span>
                          <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>+{s.score_contribution} pts</span>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: '#4b5563', margin: 0 }}>{s.evidence}</p>
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
            <h3 style={{ fontWeight: 700, color: '#1f2328', marginBottom: '1rem', fontSize: '0.95rem' }}>
              Ações Disponíveis
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {ACTIONS.map((action) => (
                <button
                  key={action.key}
                  onClick={() => setActionModal(action.key)}
                  style={{
                    padding: '0.7rem 1rem',
                    background: action.key === 'escalate_investigation' ? '#eff6ff' :
                      action.key === 'resolve' ? '#e8f5ee' : '#fff',
                    border: `1px solid ${action.key === 'escalate_investigation' ? '#bfdbfe' :
                      action.key === 'resolve' ? '#bbf7d0' : '#e5e7eb'}`,
                    borderRadius: 8, cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#1f2328', fontSize: '0.875rem' }}>
                    {action.label}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.2rem' }}>
                    {action.description}
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* Incidents */}
          {data.incidents.length > 0 && (
            <Card>
              <h3 style={{ fontWeight: 700, color: '#1f2328', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
                Investigações
              </h3>
              {data.incidents.map((inc) => (
                <div key={inc.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6' }}>
                  <StatusBadge status={inc.status} />
                  <p style={{ fontSize: '0.8rem', color: '#4b5563', marginTop: '0.3rem' }}>{inc.description}</p>
                  <p style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{formatDate(inc.created_at)}</p>
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
        <div style={{
          position: 'fixed', right: 0, top: 0, bottom: 0, width: 420,
          background: '#fff', border: '1px solid #e5e7eb',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
          display: 'flex', flexDirection: 'column', zIndex: 200,
        }}>
          <div style={{
            padding: '1rem 1.25rem',
            background: '#1f2328', color: '#fff',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontWeight: 700 }}>🤖 Guardião AI</div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>
                {chatProvider ? `Provider: ${chatProvider}` : 'Assistente de Investigação'}
              </div>
            </div>
            <button onClick={() => setChatOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.3rem' }}>×</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {messages.length === 0 && !chatLoading && (
              <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}>
                  Pergunte ao Guardião AI sobre esta transação.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMsg(q)}
                      style={{
                        background: '#f4faf6', border: '1px solid #bbf7d0',
                        borderRadius: 8, padding: '0.5rem 0.75rem',
                        fontSize: '0.82rem', cursor: 'pointer', textAlign: 'left', color: '#1f2328',
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
                style={{
                  display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div style={{
                  maxWidth: '85%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  background: m.role === 'user' ? '#005B2B' : '#f4faf6',
                  color: m.role === 'user' ? '#fff' : '#1f2328',
                  fontSize: '0.875rem', lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                }}>
                  {m.content}
                </div>
              </div>
            ))}

            {chatLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Spinner size={16} />
                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>Guardião AI pensando...</span>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          <div style={{ padding: '0.75rem', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '0.5rem' }}>
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg() } }}
              placeholder="Pergunte ao Guardião AI..."
              style={{
                flex: 1, padding: '0.6rem 0.75rem',
                border: '1.5px solid #e5e7eb', borderRadius: 8,
                fontSize: '0.875rem', outline: 'none',
              }}
            />
            <button
              onClick={() => sendMsg()}
              disabled={!chatInput.trim() || chatLoading}
              style={{
                padding: '0.6rem 1rem',
                background: '#005B2B', color: '#fff',
                border: 'none', borderRadius: 8,
                cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
              }}
            >
              →
            </button>
          </div>
        </div>
      )}
    </AnalystLayout>
  )
}
