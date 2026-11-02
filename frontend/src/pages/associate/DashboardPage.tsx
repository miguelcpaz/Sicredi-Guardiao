/**
 * Associate Dashboard — home page with balance and recent transactions
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeftRight, FileText, Bell } from 'lucide-react'
import AssociateLayout from '../../components/layout/AssociateLayout'
import { Card, Spinner, AlertBox, formatCurrency, formatDate, StatusBadge } from '../../components/ui/index'
import { getAssociateDashboard } from '../../api/client'
import type { AssociateDashboard } from '../../api/client'

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div style={{
      background: accent ? 'var(--green-600)' : 'var(--surface)',
      border: `1px solid ${accent ? 'var(--green-600)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-md)',
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.35rem',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <span style={{ fontSize: '0.78rem', color: accent ? 'rgba(255,255,255,0.75)' : 'var(--text-secondary)', fontWeight: 500 }}>
        {label}
      </span>
      <span style={{ fontSize: '1.4rem', fontWeight: 700, color: accent ? '#fff' : 'var(--text-primary)' }}>
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
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Olá, {data?.full_name?.split(' ')[0] ?? 'Associado'}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
          Conta {data?.account_number} — Bem-vindo ao seu painel
        </p>
      </div>

      {/* Stats */}
      <div className="cards-grid" style={{ marginBottom: '2rem' }}>
        <StatCard label="Saldo Disponível" value={formatCurrency(data?.balance ?? 0)} accent />
        <StatCard label="Transações" value={data?.total_transactions ?? 0} />
        <StatCard label="Alertas Pendentes" value={data?.pending_alerts ?? 0} />
        <StatCard label="Notificações" value={data?.unread_notifications ?? 0} />
      </div>

      {/* Quick actions */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>
          Ações Rápidas
        </h2>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/associate/pix')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              background: 'var(--green-600)', color: '#fff',
              border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.95rem',
              transition: 'background 0.15s',
            }}
          >
            <ArrowLeftRight size={16} />
            Fazer PIX
          </button>
          <button
            onClick={() => navigate('/associate/extrato')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              background: 'var(--surface)', color: 'var(--text-primary)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.95rem',
              transition: 'background 0.15s',
            }}
          >
            <FileText size={16} />
            Ver Extrato
          </button>
          {(data?.unread_notifications ?? 0) > 0 && (
            <button
              onClick={() => navigate('/associate/notifications')}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                background: 'var(--red-100)', color: 'var(--red-600)',
                border: '1px solid var(--red-200)', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                fontWeight: 600, fontSize: '0.95rem',
                transition: 'background 0.15s',
              }}
            >
              <Bell size={16} />
              {data?.unread_notifications} nova(s) notificação(ões)
            </button>
          )}
        </div>
      </div>

      {/* Recent transactions */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Transações Recentes
          </h2>
          <button
            onClick={() => navigate('/associate/extrato')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--green-600)', fontSize: '0.85rem', fontWeight: 600 }}
          >
            Ver todas →
          </button>
        </div>

        {!data?.recent_transactions?.length ? (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1.5rem', fontSize: '0.9rem' }}>
            Nenhuma transação recente.
          </p>
        ) : (
          <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', minWidth: 360 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Data', 'Destinatário', 'Valor', 'Status'].map((h) => (
                  <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.78rem' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.recent_transactions.map((t) => (
                <tr
                  key={t.id}
                  style={{ borderBottom: '1px solid var(--surface-2)' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-secondary)' }}>{formatDate(t.timestamp)}</td>
                  <td style={{ padding: '0.65rem 0.75rem', fontWeight: 500, color: 'var(--text-primary)' }}>{t.merchant}</td>
                  <td style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: t.status === 'approved' ? 'var(--green-600)' : 'var(--text-primary)' }}>
                    {formatCurrency(t.amount)}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem' }}><StatusBadge status={t.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Card>
    </AssociateLayout>
  )
}
