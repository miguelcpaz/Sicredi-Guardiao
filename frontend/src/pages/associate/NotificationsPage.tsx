/**
 * Associate Notifications Page — with SSE real-time updates + polling fallback
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { CheckCircle, XCircle } from 'lucide-react'
import AssociateLayout from '../../components/layout/AssociateLayout'
import { Card, Spinner, EmptyState, Button, Modal, AlertBox, formatDate } from '../../components/ui/index'
import {
  listNotifications, markNotificationRead, markAllNotificationsRead,
  respondToNotification,
} from '../../api/client'
import type { Notification } from '../../api/client'

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [responding, setResponding] = useState<number | null>(null)
  const [responseModal, setResponseModal] = useState<Notification | null>(null)
  const [responseMsg, setResponseMsg] = useState('')
  const [sseStatus, setSseStatus] = useState<'connecting' | 'connected' | 'polling'>('connecting')
  const eventSourceRef = useRef<EventSource | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadNotifications = useCallback(() => {
    listNotifications()
      .then((r) => setNotifications(r.data))
      .finally(() => setLoading(false))
  }, [])

  // SSE setup
  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) { setSseStatus('polling'); return }

    // SSE requires auth headers not supported by standard EventSource.
    // Use polling as the reliable approach.
    setSseStatus('polling')
    startPolling()

    return () => {
      eventSourceRef.current?.close()
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [loadNotifications])

  const startPolling = () => {
    loadNotifications()
    pollingRef.current = setInterval(loadNotifications, 5000)
  }

  const handleMarkRead = async (n: Notification) => {
    if (n.is_read) return
    await markNotificationRead(n.id)
    setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, is_read: true } : x))
  }

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead()
    setNotifications((prev) => prev.map((x) => ({ ...x, is_read: true })))
  }

  const handleRespond = async (response: 'recognized' | 'unrecognized') => {
    if (!responseModal) return
    setResponding(responseModal.id)
    try {
      await respondToNotification(responseModal.id, response)
      setResponseMsg(
        response === 'recognized'
          ? 'Você confirmou que reconhece esta operação. Nossa equipe de segurança foi notificada.'
          : 'Você informou que não reconhece esta operação. Nossa equipe de segurança irá investigar.'
      )
      await handleMarkRead(responseModal)
      setResponseModal(null)
      loadNotifications()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setResponseMsg(detail || 'Erro ao registrar resposta.')
    } finally {
      setResponding(null)
    }
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <AssociateLayout>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Notificações {unreadCount > 0 && (
              <span style={{ fontSize: '0.9rem', background: 'var(--red-600)', color: '#fff', borderRadius: 20, padding: '0.1rem 0.6rem', marginLeft: '0.5rem' }}>
                {unreadCount}
              </span>
            )}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.1rem' }}>
            {sseStatus === 'connected' ? 'Tempo real ativo' : 'Atualizando a cada 5s'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="ghost" onClick={handleMarkAllRead}>
            Marcar todas como lidas
          </Button>
        )}
      </div>

      {responseMsg && (
        <AlertBox
          type={responseMsg.includes('confirmou') ? 'success' : responseMsg.includes('não reconhece') ? 'warning' : 'error'}
          message={responseMsg}
          onClose={() => setResponseMsg('')}
          style={{ marginBottom: '1rem' }}
        />
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <Spinner size={36} />
        </div>
      ) : notifications.length === 0 ? (
        <Card>
          <EmptyState
            icon="🔔"
            title="Nenhuma notificação"
            description="Você receberá notificações de segurança aqui."
          />
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => handleMarkRead(n)}
              style={{
                background: 'var(--surface)',
                border: `1px solid ${n.is_read ? 'var(--border)' : 'var(--green-200)'}`,
                borderLeft: `4px solid ${n.is_read ? 'var(--border-2)' : 'var(--green-600)'}`,
                borderRadius: 'var(--radius-md)',
                padding: '1rem 1.25rem',
                cursor: 'pointer',
                transition: 'border-color 0.15s',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                    {!n.is_read && (
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green-600)', display: 'inline-block' }} />
                    )}
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{n.title}</h3>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{n.message}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDate(n.created_at)}</p>
                </div>
                {n.alert_id && !n.is_read && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setResponseModal(n) }}
                    style={{
                      background: 'var(--green-600)', color: '#fff',
                      border: 'none', borderRadius: 'var(--radius-sm)',
                      padding: '0.4rem 0.75rem',
                      fontSize: '0.78rem', fontWeight: 600,
                      cursor: 'pointer', flexShrink: 0,
                    }}
                  >
                    Responder
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Response modal */}
      {responseModal && (
        <Modal title="Confirmar Identidade" onClose={() => setResponseModal(null)}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            {responseModal.message}
          </p>
          <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
            Você reconhece esta operação?
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Button
              onClick={() => handleRespond('recognized')}
              disabled={responding === responseModal.id}
              fullWidth
            >
              <CheckCircle size={15} style={{ marginRight: '0.4rem' }} />
              Sim, reconheço esta transação
            </Button>
            <Button
              variant="danger"
              onClick={() => handleRespond('unrecognized')}
              disabled={responding === responseModal.id}
              fullWidth
            >
              <XCircle size={15} style={{ marginRight: '0.4rem' }} />
              Não reconheço esta transação
            </Button>
            <Button variant="secondary" onClick={() => setResponseModal(null)} fullWidth>
              Fechar
            </Button>
          </div>
          {responding && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
              <Spinner size={24} />
            </div>
          )}
        </Modal>
      )}
    </AssociateLayout>
  )
}
