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
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1f2328' }}>Alertas</h1>
          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
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
                background: filter === f ? '#005B2B' : '#fff',
                color: filter === f ? '#fff' : '#4b5563',
                border: '1px solid #e5e7eb',
                borderRadius: 6, cursor: 'pointer',
                fontSize: '0.82rem', fontWeight: 600,
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
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                {['Associado', 'Valor', 'Destinatário', 'Risco', 'Status', 'Resposta', 'Data', ''].map((h) => (
                  <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', color: '#6b7280', fontWeight: 600, fontSize: '0.78rem' }}>
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
                    borderBottom: '1px solid #f9fafb',
                    cursor: 'pointer',
                    background: a.status === 'pending' && a.risk_level === 'high' ? '#fff9f9' : 'transparent',
                  }}
                  onClick={() => navigate(`/analyst/alerts/${a.id}`)}
                >
                  <td style={{ padding: '0.7rem 0.75rem', fontWeight: 600 }}>
                    {a.associate_name || '—'}
                  </td>
                  <td style={{ padding: '0.7rem 0.75rem', fontWeight: 600 }}>
                    {a.amount !== null ? formatCurrency(a.amount) : '—'}
                  </td>
                  <td style={{ padding: '0.7rem 0.75rem', color: '#4b5563' }}>
                    {a.merchant || '—'}
                  </td>
                  <td style={{ padding: '0.7rem 0.75rem' }}>
                    <RiskBadge level={a.risk_level} score={a.risk_score} />
                  </td>
                  <td style={{ padding: '0.7rem 0.75rem' }}>
                    <StatusBadge status={a.status} />
                  </td>
                  <td style={{ padding: '0.7rem 0.75rem', color: '#6b7280', fontSize: '0.82rem' }}>
                    {a.response
                      ? (a.response === 'confirmed' ? '✅ Reconheceu' : '❌ Não reconheceu')
                      : '—'}
                  </td>
                  <td style={{ padding: '0.7rem 0.75rem', color: '#9ca3af', fontSize: '0.8rem' }}>
                    {formatDate(a.created_at)}
                  </td>
                  <td style={{ padding: '0.7rem 0.75rem' }}>
                    <span style={{ color: '#005B2B', fontSize: '0.82rem', fontWeight: 600 }}>
                      Ver →
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </AnalystLayout>
  )
}
