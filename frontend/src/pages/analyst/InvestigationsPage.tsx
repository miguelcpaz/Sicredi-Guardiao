/**
 * Analyst Investigations Page
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AnalystLayout from '../../components/layout/AnalystLayout'
import { Card, Spinner, EmptyState, StatusBadge, formatCurrency, formatDate } from '../../components/ui/index'
import { listIncidents } from '../../api/client'

interface Incident {
  id: number
  transaction_id: number
  alert_id: number | null
  status: string
  description: string
  created_at: string
  amount: number | null
  associate_name: string | null
}

export default function InvestigationsPage() {
  const navigate = useNavigate()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listIncidents()
      .then((r) => setIncidents(r.data as Incident[]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AnalystLayout>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>Investigações</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          {incidents.filter((i) => i.status === 'investigating').length} caso(s) em investigação ativa
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <Spinner size={36} />
        </div>
      ) : incidents.length === 0 ? (
        <Card>
          <EmptyState icon="🔎" title="Nenhuma investigação encontrada" description="Casos de alta prioridade aparecerão aqui." />
        </Card>
      ) : (
        <Card>
          <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', minWidth: 500 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['#', 'Associado', 'Valor', 'Status', 'Descrição', 'Data', ''].map((h) => (
                  <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.78rem' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc) => (
                <tr
                  key={inc.id}
                  style={{ borderBottom: '1px solid var(--surface-2)', cursor: 'pointer' }}
                  onClick={() => inc.alert_id && navigate(`/analyst/alerts/${inc.alert_id}`)}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <td style={{ padding: '0.7rem 0.75rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    #{inc.id}
                  </td>
                  <td style={{ padding: '0.7rem 0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {inc.associate_name || '—'}
                  </td>
                  <td style={{ padding: '0.7rem 0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {inc.amount !== null ? formatCurrency(inc.amount) : '—'}
                  </td>
                  <td style={{ padding: '0.7rem 0.75rem' }}>
                    <StatusBadge status={inc.status} />
                  </td>
                  <td style={{ padding: '0.7rem 0.75rem', color: 'var(--text-secondary)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {inc.description}
                  </td>
                  <td style={{ padding: '0.7rem 0.75rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {formatDate(inc.created_at)}
                  </td>
                  <td style={{ padding: '0.7rem 0.75rem' }}>
                    {inc.alert_id && (
                      <span style={{ color: 'var(--green-600)', fontSize: '0.82rem', fontWeight: 600 }}>Ver alerta →</span>
                    )}
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
