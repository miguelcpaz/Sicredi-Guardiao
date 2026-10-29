/**
 * Associate Security Center — pending security operations requiring attention
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1f2328' }}>🛡️ Central de Segurança</h1>
        <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
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
              background: '#fff',
              border: '1px solid #fde68a',
              borderLeft: '4px solid #d97706',
              borderRadius: 10,
              padding: '1.25rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1f2328', marginBottom: '0.4rem' }}>
                    ⚠️ {n.title}
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '0.5rem', lineHeight: 1.5 }}>
                    {n.message}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{formatDate(n.created_at)}</p>
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
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1f2328', marginBottom: '1rem' }}>
            Ocorrências Anteriores
          </h2>
          <Card>
            {notifications.filter((n) => n.is_read && n.alert_id).map((n) => (
              <div key={n.id} style={{
                padding: '0.75rem 0',
                borderBottom: '1px solid #f3f4f6',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem', color: '#4b5563' }}>{n.title}</span>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{formatDate(n.created_at)}</span>
                </div>
                <p style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: '0.2rem' }}>{n.message}</p>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Response modal */}
      {selected && (
        <Modal title="Verificação de Segurança" onClose={() => setSelected(null)}>
          <div style={{
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: 8,
            padding: '1rem',
            marginBottom: '1.5rem',
          }}>
            <p style={{ fontSize: '0.9rem', color: '#92400e', lineHeight: 1.6 }}>
              {selected.message}
            </p>
          </div>

          <p style={{ fontWeight: 600, color: '#1f2328', marginBottom: '1.25rem', fontSize: '0.95rem' }}>
            Você reconhece esta operação?
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Button
              onClick={() => handleRespond('recognized')}
              disabled={responding}
              fullWidth
            >
              ✅ Sim, reconheço esta transação
            </Button>
            <Button
              variant="danger"
              onClick={() => handleRespond('unrecognized')}
              disabled={responding}
              fullWidth
            >
              ❌ Não reconheço esta transação
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

          <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '1rem', textAlign: 'center' }}>
            Sua resposta será registrada e enviada à equipe de segurança.
          </p>
        </Modal>
      )}
    </AssociateLayout>
  )
}
