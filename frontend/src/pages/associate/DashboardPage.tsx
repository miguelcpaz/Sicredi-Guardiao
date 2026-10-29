/**
 * Associate Dashboard — home page with balance and recent transactions
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AssociateLayout from '../../components/layout/AssociateLayout'
import { Card, Spinner, AlertBox, formatCurrency, formatDate, StatusBadge } from '../../components/ui/index'
import { getAssociateDashboard } from '../../api/client'
import type { AssociateDashboard } from '../../api/client'

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div style={{
      background: accent ? '#005B2B' : '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 10,
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.35rem',
    }}>
      <span style={{ fontSize: '0.78rem', color: accent ? 'rgba(255,255,255,0.7)' : '#6b7280', fontWeight: 500 }}>
        {label}
      </span>
      <span style={{ fontSize: '1.4rem', fontWeight: 700, color: accent ? '#fff' : '#1f2328' }}>
        {value}
      </span>
    </div>
  )
}

export default function AssociateDashboardPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<AssociateDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getAssociateDashboard()
      .then((r) => setData(r.data))
      .catch(() => setError('Erro ao carregar dados do painel.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <AssociateLayout>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <Spinner size={36} />
      </div>
    </AssociateLayout>
  )

  return (
    <AssociateLayout>
      {error && <AlertBox type="error" message={error} />}

      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2328' }}>
          Olá, {data?.full_name?.split(' ')[0] ?? 'Associado'} 👋
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '0.2rem' }}>
          Conta {data?.account_number} — Bem-vindo ao seu painel
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <StatCard label="Saldo Disponível" value={formatCurrency(data?.balance ?? 0)} accent />
        <StatCard label="Transações" value={data?.total_transactions ?? 0} />
        <StatCard label="Alertas Pendentes" value={data?.pending_alerts ?? 0} />
        <StatCard label="Notificações" value={data?.unread_notifications ?? 0} />
      </div>

      {/* Quick actions */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1f2328', marginBottom: '1rem' }}>
          Ações Rápidas
        </h2>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/associate/pix')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              background: '#005B2B', color: '#fff',
              border: 'none', borderRadius: 8, cursor: 'pointer',
              fontWeight: 600, fontSize: '0.95rem',
            }}
          >
            ⟳ Fazer PIX
          </button>
          <button
            onClick={() => navigate('/associate/extrato')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              background: '#fff', color: '#1f2328',
              border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer',
              fontWeight: 600, fontSize: '0.95rem',
            }}
          >
            ≡ Ver Extrato
          </button>
          {(data?.unread_notifications ?? 0) > 0 && (
            <button
              onClick={() => navigate('/associate/notifications')}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                background: '#fef2f2', color: '#dc2626',
                border: '1px solid #fecaca', borderRadius: 8, cursor: 'pointer',
                fontWeight: 600, fontSize: '0.95rem',
              }}
            >
              🔔 {data?.unread_notifications} nova(s) notificação(ões)
            </button>
          )}
        </div>
      </div>

      {/* Recent transactions */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1f2328' }}>
            Transações Recentes
          </h2>
          <button
            onClick={() => navigate('/associate/extrato')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#005B2B', fontSize: '0.85rem', fontWeight: 600 }}
          >
            Ver todas →
          </button>
        </div>

        {!data?.recent_transactions?.length ? (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: '1.5rem', fontSize: '0.9rem' }}>
            Nenhuma transação recente.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                {['Data', 'Destinatário', 'Valor', 'Status'].map((h) => (
                  <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#6b7280', fontWeight: 600, fontSize: '0.78rem' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.recent_transactions.map((t) => (
                <tr key={t.id} style={{ borderBottom: '1px solid #f9fafb' }}>
                  <td style={{ padding: '0.65rem 0.75rem', color: '#6b7280' }}>{formatDate(t.timestamp)}</td>
                  <td style={{ padding: '0.65rem 0.75rem', fontWeight: 500 }}>{t.merchant}</td>
                  <td style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: t.status === 'approved' ? '#005B2B' : '#1f2328' }}>
                    {formatCurrency(t.amount)}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem' }}><StatusBadge status={t.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </AssociateLayout>
  )
}
