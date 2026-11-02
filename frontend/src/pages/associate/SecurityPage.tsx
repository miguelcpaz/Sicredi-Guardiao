/**
 * Associate Security Center — pending security operations requiring attention
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import AssociateLayout from '../../components/layout/AssociateLayout'
import { Card, Spinner, EmptyState, Modal, Button, AlertBox, formatDate } from '../../components/ui/index'
import { listNotifications, respondToNotification } from '../../api/client'
import type { Notification } from '../../api/client'

export default function SecurityPage() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Notification | null>(null)
  const [responding, setResponding] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const pendingNotifications = notifications.filter(
    (n) => n.alert_id && !n.is_read
  )

  useEffect(() => {
    listNotifications()
      .then((r) => setNotifications(r.data))
      .finally(() => setLoading(false))
  }, [])

  const handleRespond = async (response: 'recognized' | 'unrecognized') => {
    if (!selected) return
    setResponding(true)
    setErrorMsg('')
    try {
      await respondToNotification(selected.id, response)
      setSuccessMsg(
        response === 'recognized'
          ? 'Resposta registrada: você reconhece a operação. Nossa equipe foi notificada.'
          : 'Resposta registrada: você não reconhece a operação. Nossa equipe irá investigar.'
      )
      setSelected(null)
      const r = await listNotifications()
      setNotifications(r.data)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setErrorMsg(detail || 'Erro ao registrar resposta.')
    } finally {
      setResponding(false)
    }
  }

  return (
    <AssociateLayout>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          <ShieldCheck size={22} style={{ color: 'var(--green-600)' }} />
          Central de Segurança
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Operações que precisam da sua atenção
        </p>
      </div>

      {successMsg && (
        <AlertBox type="success" message={successMsg} onClose={() => setSuccessMsg('')} style={{ marginBottom: '1rem' }} />
      )}
      {errorMsg && (
        <AlertBox type="error" message={errorMsg} onClose={() => setErrorMsg('')} style={{ marginBottom: '1rem' }} />
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <Spinner size={36} />
        </div>
      ) : pendingNotifications.length === 0 ? (
        <Card>
          <EmptyState
            icon="✅"
            title="Tudo em ordem"
            description="Não há operações pendentes de verificação no momento."
          />
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <Button variant="ghost" onClick={() => navigate('/associate/notifications')}>
              Ver todas as notificações
            </Button>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {pendingNotifications.map((n) => (
            <div key={n.id} style={{
              background: 'var(--surface)',
              border: '1px solid var(--yellow-200)',
              borderLeft: '4px solid var(--yellow-600)',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              boxShadow: 'var(--shadow-sm)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                    <AlertTriangle size={16} style={{ color: 'var(--yellow-600)', flexShrink: 0 }} />
                    {n.title}
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', lineHeight: 1.5 }}>
                    {n.message}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDate(n.created_at)}</p>
                </div>
                <Button onClick={() => setSelected(n)}>
                  Verificar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* All notifications list (read) */}
      {notifications.filter((n) => n.is_read && n.alert_id).length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>
            Ocorrências Anteriores
          </h2>
          <Card>
            {notifications.filter((n) => n.is_read && n.alert_id).map((n) => (
              <div key={n.id} style={{
                padding: '0.75rem 0',
                borderBottom: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{n.title}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDate(n.created_at)}</span>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{n.message}</p>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Response modal */}
      {selected && (
        <Modal title="Verificação de Segurança" onClose={() => setSelected(null)}>
          <div style={{
            background: 'var(--yellow-100)',
            border: '1px solid var(--yellow-200)',
            borderRadius: 'var(--radius-sm)',
            padding: '1rem',
            marginBottom: '1.5rem',
          }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--yellow-600)', lineHeight: 1.6 }}>
              {selected.message}
            </p>
          </div>

          <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1.25rem', fontSize: '0.95rem' }}>
            Você reconhece esta operação?
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Button
              onClick={() => handleRespond('recognized')}
              disabled={responding}
              fullWidth
            >
              <CheckCircle size={15} style={{ marginRight: '0.4rem' }} />
              Sim, reconheço esta transação
            </Button>
            <Button
              variant="danger"
              onClick={() => handleRespond('unrecognized')}
              disabled={responding}
              fullWidth
            >
              <XCircle size={15} style={{ marginRight: '0.4rem' }} />
              Não reconheço esta transação
            </Button>
            <Button variant="secondary" onClick={() => setSelected(null)} fullWidth>
              Responder depois
            </Button>
          </div>

          {responding && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
              <Spinner size={24} />
            </div>
          )}

          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1rem', textAlign: 'center' }}>
            Sua resposta será registrada e enviada à equipe de segurança.
          </p>
        </Modal>
      )}
    </AssociateLayout>
  )
}
