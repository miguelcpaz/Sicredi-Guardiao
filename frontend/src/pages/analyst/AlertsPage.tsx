/**
 * Analyst Alerts Page — list and manage alerts
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AnalystLayout from '../../components/layout/AnalystLayout'
import { Card, Spinner, EmptyState, RiskBadge, StatusBadge, formatCurrency, formatDate } from '../../components/ui/index'
import { listAnalystAlerts } from '../../api/client'

interface Alert {
  id: number
  transaction_id: number
  risk_score: number
  risk_level: string
  status: string
  response: string | null
  created_at: string
  amount: number | null
  merchant: string | null
  associate_name: string | null
  associate_id: number | null
}

export default function AlertsPage() {
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'high'>('all')

  useEffect(() => {
    listAnalystAlerts()
      .then((r) => setAlerts(r.data as Alert[]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = alerts.filter((a) => {
    if (filter === 'pending') return a.status === 'pending'
    if (filter === 'high') return a.risk_level === 'high'
    return true
  })

  return (
    <AnalystLayout>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>Alertas</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {alerts.filter((a) => a.status === 'pending').length} alerta(s) pendente(s)
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['all', 'pending', 'high'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '0.4rem 0.85rem',
                background: filter === f ? 'var(--green-600)' : 'var(--surface)',
                color: filter === f ? '#fff' : 'var(--text-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                fontSize: '0.82rem', fontWeight: 600,
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendentes' : 'Alto Risco'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <Spinner size={36} />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState icon="✅" title="Nenhum alerta encontrado" description="Não há alertas para o filtro selecionado." />
        </Card>
      ) : (
        <Card>
          <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', minWidth: 520 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Associado', 'Valor', 'Destinatário', 'Risco', 'Status', 'Resposta', 'Data', ''].map((h) => (
                  <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.78rem' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr
                  key={a.id}
                  style={{
                    borderBottom: '1px solid var(--surface-2)',
                    cursor: 'pointer',
                    background: a.status === 'pending' && a.risk_level === 'high' ? 'var(--red-100)' : 'transparent',
                  }}
                  onClick={() => navigate(`/analyst/alerts/${a.id}`)}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = a.status === 'pending' && a.risk_level === 'high' ? 'var(--red-100)' : 'transparent' }}
                >
                  <td style={{ padding: '0.7rem 0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {a.associate_name || '—'}
                  </td>
                  <td style={{ padding: '0.7rem 0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {a.amount !== null ? formatCurrency(a.amount) : '—'}
                  </td>
                  <td style={{ padding: '0.7rem 0.75rem', color: 'var(--text-secondary)' }}>
                    {a.merchant || '—'}
                  </td>
                  <td style={{ padding: '0.7rem 0.75rem' }}>
                    <RiskBadge level={a.risk_level} score={a.risk_score} />
                  </td>
                  <td style={{ padding: '0.7rem 0.75rem' }}>
                    <StatusBadge status={a.status} />
                  </td>
                  <td style={{ padding: '0.7rem 0.75rem', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                    {a.response
                      ? (a.response === 'confirmed' ? '✓ Reconheceu' : '✗ Não reconheceu')
                      : '—'}
                  </td>
                  <td style={{ padding: '0.7rem 0.75rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {formatDate(a.created_at)}
                  </td>
                  <td style={{ padding: '0.7rem 0.75rem' }}>
                    <span style={{ color: 'var(--green-600)', fontSize: '0.82rem', fontWeight: 600 }}>
                      Ver →
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>
      )}
    </AnalystLayout>
  )
}
